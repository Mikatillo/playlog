import { NextRequest, NextResponse } from 'next/server';
import { igdbQuery, mapIgdbGame, IgdbGame } from '@/lib/igdb';
import { IGDB_GAME_FIELDS } from '@/lib/igdb-shared';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get('ids') || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s))
    .map(Number)
    .slice(0, 200);

  if (ids.length === 0) return NextResponse.json({ results: [] });

  try {
    const raw = await igdbQuery<IgdbGame[]>(
      'games',
      `${IGDB_GAME_FIELDS}
       where id = (${ids.join(',')});
       limit ${Math.min(ids.length, 500)};`,
      10 * 60 * 1000,
    );

    // порядок как в запросе
    const byId = new Map(raw.map((g) => [g.id, mapIgdbGame(g)]));
    const results = ids.map((id) => byId.get(id)).filter(Boolean);

    return NextResponse.json(
      { results },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    );
  } catch (error) {
    console.error('[IGDB batch] error:', error);
    return NextResponse.json({ error: 'Failed to fetch', results: [] }, { status: 500 });
  }
}
