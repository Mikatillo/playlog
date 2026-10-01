import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.RAWG_API_KEY || 'demo';
const BASE_URL = 'https://api.rawg.io/api';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') || '1';
  const pageSize = searchParams.get('pageSize') || '20';
  const ordering = searchParams.get('ordering') || '-added';
  const genres = searchParams.get('genres') || '';

  try {
    let url = `${BASE_URL}/games?key=${API_KEY}&page=${page}&page_size=${pageSize}&ordering=${ordering}&language=rus`;
    if (genres) url += `&genres=${genres}`;

    const response = await fetch(url, { next: { revalidate: 3600 } });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Games API error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}