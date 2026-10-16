import { NextRequest, NextResponse } from 'next/server';
import { igdbQuery, igdbEscape, mapIgdbGame, IgdbGame, findSteamAppIdByTitle, steamHeaderUrl } from '@/lib/igdb';
import { IGDB_GAME_FIELDS, isEdition } from '@/lib/igdb-shared';
import { searchCustomGames } from '@/lib/custom-games';
import type { Game } from '@/types/game';
import { applyOverrides } from '@/lib/overrides';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  // all=1 — без фильтров качества: находит старые, редкие и малоизвестные игры
  const all = searchParams.get('all') === '1';

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
       ${
         all
           ? 'where game_type = (0,8,9,10,11);'
           : 'where game_type = 0 & cover != null & version_parent = null;'
       }
       limit ${all ? 50 : 40};`,
      5 * 60 * 1000,
    );

    // В полном режиме ничего не скрываем и сохраняем порядок релевантности IGDB
    const filtered = all
      ? raw.slice(0, 50)
      : raw
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
        if (all) return mapped; // полный режим: без лишних запросов в Steam

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

    // Карточки, созданные пользователями, показываем первыми
    const custom = await searchCustomGames(search).catch(() => [] as Game[]);
    const merged = [...custom, ...(await applyOverrides(results))];

    return NextResponse.json(
      { results: merged, count: merged.length },
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