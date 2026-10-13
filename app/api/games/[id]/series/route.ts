import { NextRequest, NextResponse } from 'next/server';
import { igdbQuery, mapIgdbGame, IgdbGame } from '@/lib/igdb';
import { IGDB_GAME_FIELDS } from '@/lib/igdb-shared';

const DAY = 24 * 60 * 60 * 1000;

// Игры той же серии (Assassin's Creed, Witcher и т.д.): сначала коллекция IGDB, если её нет — франшиза.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ results: [] });
  const gameId = Number(id);

  try {
    const base = await igdbQuery<{ collections?: number[]; franchises?: number[] }[]>(
      'games',
      `fields collections, franchises; where id = ${gameId}; limit 1;`,
      DAY,
    );
    const collections = base?.[0]?.collections || [];
    const franchises = base?.[0]?.franchises || [];

    let where: string | null = null;
    if (collections.length > 0) where = `collections = (${collections.join(',')})`;
    else if (franchises.length > 0) where = `franchises = (${franchises.join(',')})`;
    if (!where) return NextResponse.json({ results: [] });

    // game_type: 0 — основная игра, 8 — ремейк, 9 — ремастер
    const raw = await igdbQuery<IgdbGame[]>(
      'games',
      `${IGDB_GAME_FIELDS}
       where ${where} & id != ${gameId} & game_type = (0,8,9) & version_parent = null & cover != null;
       sort total_rating_count desc;
       limit 30;`,
      DAY,
    );

    const results = raw
      .map(mapIgdbGame)
      // по порядку выхода: 1, 2, 3...
      .sort((a, b) => (a.released || '9999').localeCompare(b.released || '9999'));

    return NextResponse.json(
      { results },
      { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } },
    );
  } catch (error) {
    console.error('[series] error:', error);
    return NextResponse.json({ results: [] });
  }
}
