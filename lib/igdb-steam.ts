import { igdbQuery, IgdbGame } from '@/lib/igdb';
import { IGDB_GAME_FIELDS } from '@/lib/igdb-shared';

/** Steam appid → игра IGDB (сырой объект). Два запроса: external_games, затем games. */
export async function matchSteamApps(appids: number[]): Promise<Map<number, IgdbGame>> {
  const out = new Map<number, IgdbGame>();
  const unique = [...new Set(appids.filter(Boolean))];
  if (unique.length === 0) return out;

  const uids = unique.map((a) => `"${a}"`).join(',');
  const ext = await igdbQuery<{ game?: number; uid: string }[]>(
    'external_games',
    `fields game, uid; where external_game_source = 1 & uid = (${uids}); limit 500;`,
    30 * 60 * 1000,
  );

  const gameIdByApp = new Map<number, number>();
  ext.forEach((e) => {
    if (e.game) gameIdByApp.set(Number(e.uid), e.game);
  });
  const ids = [...new Set(gameIdByApp.values())];
  if (ids.length === 0) return out;

  const raw = await igdbQuery<IgdbGame[]>(
    'games',
    `${IGDB_GAME_FIELDS} where id = (${ids.join(',')}); limit ${Math.min(ids.length, 500)};`,
    30 * 60 * 1000,
  );
  const byId = new Map(raw.map((g) => [g.id, g]));
  gameIdByApp.forEach((gameId, appid) => {
    const g = byId.get(gameId);
    if (g) out.set(appid, g);
  });
  return out;
}
