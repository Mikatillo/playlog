import { NextRequest, NextResponse } from 'next/server';

const RAWG_API_KEY = process.env.RAWG_API_KEY || 'demo';
const RAWG_BASE = 'https://api.rawg.io/api';

const RAWG_FIELDS = [
  'id', 'name', 'background_image', 'released', 'rating',
  'metacritic', 'genres', 'tags', 'platforms', 'playtime',
].join(',');

interface SteamEntry {
  appid: number;
  name: string;
  players: number; // пик игроков онлайн (если известен)
}

// ----- Кэш в памяти сервера -----
const CACHE_TTL = 10 * 60 * 1000; // список и онлайн обновляем каждые 10 минут
let listCache: { data: any[]; expiresAt: number } | null = null;
const rawgMatchCache = new Map<string, any | null>(); // название → игра RAWG (живёт долго)

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/[^a-z0-9а-яё]+/g, ' ')
    .trim();
}

async function getJson(url: string, revalidate: number): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PlayLog/1.0' },
      next: { revalidate },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Источник 1: раздел Steam «Популярные новинки» (то же, что во вкладке «Новое и популярное»)
async function fromSteamNewPopular(limit: number): Promise<SteamEntry[]> {
  const data = await getJson(
    `https://store.steampowered.com/search/results/?query&start=0&count=${limit + 10}&filter=popularnew&category1=998&json=1&cc=us&l=english`,
    900,
  );
  const items: any[] = data?.items || [];
  const out: SteamEntry[] = [];
  for (const it of items) {
    const name = String(it?.name || '');
    // appid берём из ссылки на картинку: .../steam/apps/<appid>/...
    const m = String(it?.logo || '').match(/\/apps\/(\d+)\//);
    if (!name || !m) continue;
    out.push({ appid: Number(m[1]), name, players: 0 });
  }
  return out.slice(0, limit + 6);
}

// Текущий онлайн игры — официальный счётчик Steam (без ключа)
async function currentPlayers(appid: number): Promise<number> {
  if (!appid) return 0;
  const data = await getJson(
    `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appid}`,
    300,
  );
  return Number(data?.response?.player_count) || 0;
}

// Запасной вариант: пик игроков за сутки из чарта Steam — подставляем тем новинкам, которые в него попали
async function playersFromChart(): Promise<Map<number, number>> {
  const data = await getJson(
    'https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/',
    600,
  );
  const map = new Map<number, number>();
  (data?.response?.ranks || []).forEach((r: any) => map.set(Number(r.appid), Number(r.peak_in_game) || 0));
  return map;
}

// Запасной источник: популярные игры из Steam, вышедшие за последние ~4 месяца (по данным RAWG)
async function fromRawgRecent(limit: number): Promise<any[]> {
  const now = new Date();
  const from = new Date(now.getTime() - 120 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  const data = await getJson(
    `${RAWG_BASE}/games?key=${RAWG_API_KEY}&dates=${from},${to}&stores=1&ordering=-added&exclude_additions=true&page_size=${limit}&fields=${RAWG_FIELDS}`,
    3600,
  );
  return (data?.results || []).filter((g: any) => g?.background_image);
}

// Находим игру в RAWG по названию — нужна, чтобы карточка открывалась как обычная игра PlayLog
async function matchRawg(entry: SteamEntry): Promise<any | null> {
  const key = norm(entry.name);
  if (rawgMatchCache.has(key)) return rawgMatchCache.get(key) ?? null;

  const url = `${RAWG_BASE}/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(entry.name)}&search_precise=true&page_size=5&fields=${RAWG_FIELDS}`;
  const data = await getJson(url, 86400);
  const results: any[] = data?.results || [];
  if (results.length === 0) return null; // не кэшируем «пусто»: возможно, сбой сети

  const best =
    results.find((g) => norm(g.name) === key) ||
    results.find((g) => norm(g.name).startsWith(key) || key.startsWith(norm(g.name))) ||
    results[0];

  rawgMatchCache.set(key, best || null);
  return best || null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || '24'), 1), 40);

  if (listCache && Date.now() < listCache.expiresAt && listCache.data.length >= Math.min(limit, 10)) {
    return NextResponse.json(
      { results: listCache.data.slice(0, limit), updatedAt: listCache.expiresAt - CACHE_TTL },
      { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' } },
    );
  }

  try {
    const entries = await fromSteamNewPopular(limit);
    const out: any[] = [];

    if (entries.length > 0) {
      const players = await playersFromChart();
      const seen = new Set<number>();
      const minYear = new Date().getFullYear() - 2; // защита от неверного совпадения с старой игрой
      for (let i = 0; i < entries.length; i += 6) {
        const batch = entries.slice(i, i + 6);
        const matched = await Promise.all(batch.map((e) => matchRawg(e)));
        matched.forEach((g, idx) => {
          if (!g || seen.has(g.id) || !g.background_image) return;
          if ((Number(g.released?.split('-')[0]) || 9999) < minYear) return;
          seen.add(g.id);
          const e = batch[idx];
          out.push({ ...g, steam: { appid: e.appid, players: 0, rank: out.length + 1 } });
        });
      }

      // Онлайн для КАЖДОЙ игры: сначала живой счётчик Steam, если его нет — пик из чарта
      await Promise.all(
        out.map(async (g) => {
          const live = await currentPlayers(g.steam.appid);
          g.steam.players = live || players.get(g.steam.appid) || 0;
        }),
      );
    }

    // Steam не ответил или совпадений мало — берём популярные новинки из RAWG
    if (out.length < 8) {
      const recent = await fromRawgRecent(limit);
      const seen = new Set(out.map((g) => g.id));
      recent.forEach((g) => {
        if (seen.has(g.id)) return;
        seen.add(g.id);
        out.push({ ...g, steam: { appid: 0, players: 0, rank: out.length + 1 } });
      });
    }

    if (out.length > 0) {
      listCache = { data: out, expiresAt: Date.now() + CACHE_TTL };
    } else if (listCache) {
      return NextResponse.json({ results: listCache.data.slice(0, limit), stale: true });
    }

    return NextResponse.json(
      { results: out.slice(0, limit), updatedAt: Date.now() },
      { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' } },
    );
  } catch (error) {
    console.error('Steam popular error:', error);
    if (listCache) return NextResponse.json({ results: listCache.data.slice(0, limit), stale: true });
    return NextResponse.json({ results: [] });
  }
}
