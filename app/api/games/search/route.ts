import { NextRequest, NextResponse } from 'next/server';
import { igdbQuery, igdbEscape, mapIgdbGame, IgdbGame, findSteamAppIdByTitle, steamHeaderUrl } from '@/lib/igdb';
import { IGDB_GAME_FIELDS, isEdition } from '@/lib/igdb-shared';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';

  if (!search.trim()) {
    return NextResponse.json({ results: [], count: 0 });
  }

  try {
    const term = igdbEscape(search).slice(0, 80);
    if (term.length < 2) return NextResponse.json({ results: [], count: 0 });

    const raw: IgdbGame[] = await igdbQuery(
      'games',
      `search "${term}";
       ${IGDB_GAME_FIELDS}
       where game_type = 0 & cover != null & version_parent = null;
       limit 40;`,
      5 * 60 * 1000,
    );

    const filtered = raw
      .filter((g) => !isEdition(g.name))
      .filter((g) => (g.total_rating_count || g.rating_count || 0) >= 3)
      .sort((a, b) => {
        const aCount = a.total_rating_count || a.rating_count || 0;
        const bCount = b.total_rating_count || b.rating_count || 0;
        return bCount - aCount;
      })
      .slice(0, 20);

    // Параллельно ищем Steam appid для игр без Steam в external_games
    const results = await Promise.all(
      filtered.map(async (g) => {
        const mapped = mapIgdbGame(g);

        // Если обложка уже из Steam (mapIgdbGame поставил её через external_games) — не трогаем
        const hasSteamCover = mapped.cover.includes('steamstatic.com');
        if (hasSteamCover) return mapped;

        // Пробуем найти Steam appid по названию
        const appid = await findSteamAppIdByTitle(g.name);
        if (appid) {
          mapped.coverAlt = mapped.cover || undefined;
          mapped.cover = steamHeaderUrl(appid);
        }
        return mapped;
      }),
    );

    return NextResponse.json(
      { results, count: results.length },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
        },
      },
    );
  } catch (error: any) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch', results: [] },
      { status: 500 },
    );
  }
}