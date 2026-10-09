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
  const search = searchParams.get('search') || '';

  if (!search.trim()) {
    return NextResponse.json({ results: [], count: 0 });
  }

  try {
    const url = `${BASE_URL}/games?key=${API_KEY}&search=${encodeURIComponent(search)}&language=rus&page_size=20&fields=${GAME_FIELDS}`;
    const response = await fetch(url, { next: { revalidate: 3600 } });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }

    const data = await response.json();
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}