import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.RAWG_API_KEY || 'demo';
const BASE_URL = 'https://api.rawg.io/api';

// Игры той же серии (Assassin's Creed, Witcher и т.д.) — берём у RAWG
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ results: [] });
  }

  try {
    const res = await fetch(
      `${BASE_URL}/games/${id}/game-series?key=${API_KEY}&page_size=40`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) return NextResponse.json({ results: [] });

    const data = await res.json();
    const results = (data.results || [])
      .filter((g: any) => g && g.id !== Number(id) && g.background_image)
      .map((g: any) => ({
        id: g.id,
        name: g.name,
        background_image: g.background_image,
        released: g.released || null,
        rating: g.rating || 0,
        metacritic: g.metacritic || null,
        genres: g.genres || [],
        platforms: g.platforms || [],
        playtime: g.playtime || null,
      }))
      // по порядку выхода: 1, 2, 3...
      .sort((a: any, b: any) => (a.released || '9999').localeCompare(b.released || '9999'));

    return NextResponse.json(
      { results },
      { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } },
    );
  } catch (error) {
    console.error('[series] error:', error);
    return NextResponse.json({ results: [] });
  }
}
