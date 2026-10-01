import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.RAWG_API_KEY || 'demo';
const BASE_URL = 'https://api.rawg.io/api';

// Для полных данных (модалка) нужны description и movies
const DETAIL_FIELDS = [
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
  'description',
  'description_raw',
  'movies',
].join(',');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const full = searchParams.get('full') === 'true';

  try {
    const url = `${BASE_URL}/games/${id}?key=${API_KEY}&language=rus&fields=${DETAIL_FIELDS}`;
    const response = await fetch(url, { next: { revalidate: 3600 } });

    if (!response.ok) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const data = await response.json();

    if (!full) {
      return NextResponse.json(data);
    }

    const [ssResponse, mvResponse] = await Promise.all([
      fetch(`${BASE_URL}/games/${id}/screenshots?key=${API_KEY}`, {
        next: { revalidate: 86400 },
      }).catch(() => null),
      fetch(`${BASE_URL}/games/${id}/movies?key=${API_KEY}`, {
        next: { revalidate: 86400 },
      }).catch(() => null),
    ]);

    let screenshots: any[] = [];
    let movies: any[] = [];

    if (ssResponse?.ok) {
      try {
        const ssData = await ssResponse.json();
        screenshots = ssData.results || [];
      } catch {}
    }
    if (mvResponse?.ok) {
      try {
        const mvData = await mvResponse.json();
        movies = mvData.results || [];
      } catch {}
    }

    return NextResponse.json({
      ...data,
      screenshots,
      movies,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}