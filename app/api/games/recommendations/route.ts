import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.RAWG_API_KEY || 'demo';
const BASE_URL = 'https://api.rawg.io/api';

const FIELDS = [
  'id', 'name', 'background_image', 'released', 'rating',
  'metacritic', 'genres', 'tags', 'platforms', 'playtime',
].join(',');

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get('ids') || '';
  const excludeIds = idsParam.split(',').map((s) => s.trim()).filter(Boolean);

  if (excludeIds.length === 0) {
    return NextResponse.json({ results: [] });
  }

  try {
    // 1. Берём жанры игр пользователя (первые 5)
    const sample = excludeIds.slice(0, 5);
    const userGamesData = await Promise.all(
      sample.map(async (id) => {
        try {
          const r = await fetch(
            `${BASE_URL}/games/${id}?key=${API_KEY}&fields=genres`,
            { next: { revalidate: 3600 } },
          );
          if (!r.ok) return null;
          return await r.json();
        } catch {
          return null;
        }
      }),
    );

    // 2. Считаем частоту жанров
    const genreCount: Record<string, number> = {};
    userGamesData.forEach((g) => {
      g?.genres?.forEach((genre: any) => {
        const key = String(genre.id);
        genreCount[key] = (genreCount[key] || 0) + 1;
      });
    });

    const topGenres = Object.entries(genreCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id);

    if (topGenres.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // 3. Ищем похожие игры
    const url = `${BASE_URL}/games?key=${API_KEY}&genres=${topGenres.join(',')}&ordering=-rating&page_size=40&language=rus&fields=${FIELDS}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
    const data = await res.json();

    // 4. Исключаем уже добавленные игры
    const excludeSet = new Set(excludeIds.map(Number));
    const filtered = (data.results || []).filter((g: any) => !excludeSet.has(g.id));

    return NextResponse.json({ results: filtered.slice(0, 8) }, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
  } catch (error) {
    console.error('Recommendations error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}