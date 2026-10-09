import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.RAWG_API_KEY || 'demo';
const BASE_URL = 'https://api.rawg.io/api';

const GAME_FIELDS = [
  'id', 'name', 'background_image', 'released', 'rating',
  'metacritic', 'genres', 'tags', 'platforms', 'playtime',
].join(',');

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get('ids') || '';
  const ids = idsParam
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s))
    .slice(0, 200);

  if (ids.length === 0) {
    return NextResponse.json({ results: [] });
  }

  try {
    // Параллельно, но с ограничением — по 16 игр за раз
    const results: any[] = [];
    const concurrency = 16;

    for (let i = 0; i < ids.length; i += concurrency) {
      const batch = ids.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(async (id) => {
          try {
            const res = await fetch(
              `${BASE_URL}/games/${id}?key=${API_KEY}&language=rus&fields=${GAME_FIELDS}`,
              { next: { revalidate: 3600 } },
            );
            if (!res.ok) return null;
            return await res.json();
          } catch {
            return null;
          }
        }),
      );
      results.push(...batchResults);
    }

    return NextResponse.json(
      { results: results.filter(Boolean) },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      },
    );
  } catch (error) {
    console.error('Batch error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}