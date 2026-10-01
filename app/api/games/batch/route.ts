import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.RAWG_API_KEY || 'demo';
const BASE_URL = 'https://api.rawg.io/api';

const GAME_FIELDS = [
  'id',
  'name',
  'background_image',
  'released',
  'rating',
  'metacritic',
  'genres',
  'tags',
  'platforms',
  'playtime',
].join(',');

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get('ids') || '';
  const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await Promise.all(
      ids.map(async (id) => {
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
    return NextResponse.json({ results: results.filter(Boolean) });
  } catch (error) {
    console.error('Batch error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}