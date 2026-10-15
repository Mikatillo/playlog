import { NextRequest, NextResponse } from 'next/server';
import { igdbQuery, mapIgdbGame, IgdbGame } from '@/lib/igdb';
import { IGDB_GAME_FIELDS } from '@/lib/igdb-shared';
import { fetchCustomGames, isCustomId } from '@/lib/custom-games';
import type { Game } from '@/types/game';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get('ids') || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s))
    .map(Number)
    .slice(0, 200);

  if (ids.length === 0) return NextResponse.json({ results: [] });

  // Пользовательские карточки (id ≥ 1 млрд) берём из своей базы, остальное — из IGDB
  const customIds = ids.filter(isCustomId);
  const igdbIds = ids.filter((id) => !isCustomId(id));
  const customGames = await fetchCustomGames(customIds).catch(() => [] as Game[]);
  const customById = new Map(customGames.map((g) => [g.id, g]));

  if (igdbIds.length === 0) {
    return NextResponse.json({ results: ids.map((id) => customById.get(id)).filter(Boolean) });
  }

  try {
    const raw = await igdbQuery<IgdbGame[]>(
      'games',
      `${IGDB_GAME_FIELDS}
       where id = (${igdbIds.join(',')});
       limit ${Math.min(igdbIds.length, 500)};`,
      10 * 60 * 1000,
    );

    // порядок как в запросе
    const byId = new Map(raw.map((g) => [g.id, mapIgdbGame(g)]));
    const results = ids.map((id) => byId.get(id) || customById.get(id)).filter(Boolean);

    return NextResponse.json(
      { results },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    );
  } catch (error) {
    console.error('[IGDB batch] error:', error);
    return NextResponse.json({ error: 'Failed to fetch', results: [] }, { status: 500 });
  }
}
