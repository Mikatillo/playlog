import { NextRequest, NextResponse } from 'next/server';
import {
  igdbQuery,
  mapIgdbGame,
  IgdbGame,
  findSteamAppIdByTitle,
  steamHeaderUrl,
} from '@/lib/igdb';
import { IGDB_GAME_FIELDS } from '@/lib/igdb-shared';
import { fetchCustomGames, isCustomId } from '@/lib/custom-games';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gameId = Number(id);

  if (!gameId || isNaN(gameId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  if (isCustomId(gameId)) {
    const [custom] = await fetchCustomGames([gameId]);
    if (!custom) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    return NextResponse.json(custom);
  }

  try {
    const raw: IgdbGame[] = await igdbQuery(
      'games',
      `${IGDB_GAME_FIELDS}
       where id = ${gameId};
       limit 1;`,
      30 * 60 * 1000,
    );

    if (!raw || raw.length === 0) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const rawGame = raw[0];
    const game = mapIgdbGame(rawGame);

    // Проверяем: обложка уже из Steam?
    const hasSteamCover = game.cover.includes('steamstatic.com');

    if (!hasSteamCover) {
      // Ищем Steam appid по названию
      const appid = await findSteamAppIdByTitle(rawGame.name);
      if (appid) {
        game.coverAlt = game.cover || undefined;
        game.cover = steamHeaderUrl(appid);

        // Если в платформах нет PC — добавляем, раз игра есть в Steam
        const hasPC = game.platforms.some((p) =>
          /PC|Windows/i.test(p)
        );
        if (!hasPC) {
          game.platforms = ['PC (Microsoft Windows)', ...game.platforms];
        }
      }
    }

    return NextResponse.json(game, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error: any) {
    console.error('[IGDB game by id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}