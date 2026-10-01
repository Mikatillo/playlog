import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.RAWG_API_KEY || 'demo';
const BASE_URL = 'https://api.rawg.io/api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const full = searchParams.get('full') === 'true';

  try {
    // language=rus — данные сразу на русском
    const url = `${BASE_URL}/games/${id}?key=${API_KEY}&language=rus`;
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const data = await response.json();

    if (full) {
      const screenshotsUrl = `${BASE_URL}/games/${id}/screenshots?key=${API_KEY}`;
      const moviesUrl = `${BASE_URL}/games/${id}/movies?key=${API_KEY}`;

      let screenshots: any[] = [];
      let movies: any[] = [];

      try {
        const ssResponse = await fetch(screenshotsUrl, { cache: 'no-store' });
        if (ssResponse.ok) {
          const ssData = await ssResponse.json();
          screenshots = ssData.results || [];
        }
      } catch (e) {
        console.error('Screenshots fetch error:', e);
      }

      try {
        const mvResponse = await fetch(moviesUrl, { cache: 'no-store' });
        if (mvResponse.ok) {
          const mvData = await mvResponse.json();
          movies = mvData.results || [];
        }
      } catch (e) {
        console.error('Movies fetch error:', e);
      }

      return NextResponse.json({
        ...data,
        screenshots,
        movies,
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}