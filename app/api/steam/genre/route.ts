import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.RAWG_API_KEY || 'demo';
const BASE_URL = 'https://api.rawg.io/api';

const FIELDS = [
  'id', 'name', 'background_image', 'released', 'rating',
  'metacritic', 'genres', 'tags', 'platforms', 'playtime',
].join(',');

// Самые популярные игры Steam за всё время (stores=1), по желанию — одного жанра. Листается постранично.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const genre = (searchParams.get('genre') || '').replace(/[^a-z0-9-]/gi, '');
  const page = Math.max(1, Number(searchParams.get('page') || '1'));

  try {
    const url =
      `${BASE_URL}/games?key=${API_KEY}${genre ? `&genres=${genre}` : ''}&stores=1` +
      `&ordering=-added&exclude_additions=true&page=${page}&page_size=20&language=rus&fields=${FIELDS}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return NextResponse.json({ results: [], next: false });

    const data = await res.json();
    const results = (data.results || []).filter((g: any) => g?.background_image);
    return NextResponse.json(
      { results, next: !!data.next },
      { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } },
    );
  } catch (error) {
    console.error('Steam genre error:', error);
    return NextResponse.json({ results: [], next: false });
  }
}
