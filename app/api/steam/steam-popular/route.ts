import { NextRequest, NextResponse } from 'next/server';
import { mapRawgGame, RawgGame } from '@/lib/rawg';

const RAWG_API_KEY = process.env.RAWG_API_KEY || 'demo';
const RAWG_BASE = 'https://api.rawg.io/api';
const STEAMSPY_TOP_URL = 'https://steamspy.com/api.php?request=top100in2weeks';

// Небольшая задержка между запросами к RAWG, чтобы не превысить лимиты
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get('limit') || '20');

  try {
    // 1. Забираем топ Steam из SteamSpy
    const topRes = await fetch(STEAMSPY_TOP_URL, {
      next: { revalidate: 3600 }, // кеш 1 час
    });

    if (!topRes.ok) {
      return NextResponse.json({ error: 'SteamSpy failed' }, { status: 502 });
    }

    const topData = await topRes.json();
    // SteamSpy возвращает объект вида { "730": { name: "Counter-Strike 2", ... }, ... }
    const topGames = Object.values(topData)
      .slice(0, limit)
      .map((g: any) => g.name)
      .filter(Boolean);

    if (topGames.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // 2. Для каждой игры ищем её в RAWG (параллельно, но с ограничением)
    const games: RawgGame[] = [];
    const concurrency = 5;

    for (let i = 0; i < topGames.length; i += concurrency) {
      const batch = topGames.slice(i, i + concurrency);
      const results = await Promise.all(
        batch.map(async (title) => {
          try {
            const searchUrl = `${RAWG_BASE}/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(title)}&page_size=1&stores=1`;
            const res = await fetch(searchUrl, { next: { revalidate: 86400 } });
            if (!res.ok) return null;
            const data = await res.json();
            return data.results?.[0] || null;
          } catch {
            return null;
          }
        }),
      );
      games.push(...results.filter(Boolean));
      await sleep(200); // пауза между батчами
    }

    // 3. Преобразуем в формат, который понимает фронтенд
    const mappedGames = games.map((g: any) => mapRawgGame(g));

    // 4. Сортируем — сохраняем порядок Steam (SteamSpy отдаёт уже отсортированными)
    const orderedGames = topGames
      .map((title) => mappedGames.find((g) => g.title.toLowerCase().includes(title.toLowerCase())))
      .filter((g): g is ReturnType<typeof mapRawgGame> => !!g);

    return NextResponse.json({ results: orderedGames });
  } catch (error) {
    console.error('Steam popular error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}