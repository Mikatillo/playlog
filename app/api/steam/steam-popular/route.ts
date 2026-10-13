import { NextRequest, NextResponse } from 'next/server';
import { igdbQuery, mapIgdbGame, IgdbGame } from '@/lib/igdb';
import { IGDB_GAME_FIELDS, isEdition } from '@/lib/igdb-shared';
import type { Game } from '@/types/game';

interface SteamEntry {
  appid: number;
  name: string;
  players: number;
}

type SteamGame = Game & { steam: { appid: number; players: number; rank: number } };

// ----- Кэш в памяти сервера -----
const CACHE_TTL = 10 * 60 * 1000; // список и онлайн обновляем каждые 10 минут
let listCache: { data: SteamGame[]; expiresAt: number } | null = null;

async function getJson(url: string, revalidate: number): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PlayLog/1.0' },
      next: { revalidate },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Источник: раздел Steam «Популярные новинки»
async function fromSteamNewPopular(limit: number): Promise<SteamEntry[]> {
  const data = await getJson(
    `https://store.steampowered.com/search/results/?query&start=0&count=${limit + 10}&filter=popularnew&category1=998&json=1&cc=us&l=english`,
    900,
  );
  const items: any[] = data?.items || [];
  const out: SteamEntry[] = [];
  for (const it of items) {
    const name = String(it?.name || '');
    // appid берём из ссылки на картинку: .../steam/apps/<appid>/...
    const m = String(it?.logo || '').match(/\/apps\/(\d+)\//);
    if (!name || !m) continue;
    out.push({ appid: Number(m[1]), name, players: 0 });
  }
  return out.slice(0, limit + 6);
}

// Текущий онлайн игры — официальный счётчик Steam (без ключа)
async function currentPlayers(appid: number): Promise<number> {
  if (!appid) return 0;
  const data = await getJson(
    `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appid}`,
    300,
  );
  return Number(data?.response?.player_count) || 0;
}

// Запасной вариант: пик игроков за сутки из чарта Steam
async function playersFromChart(): Promise<Map<number, number>> {
  const data = await getJson(
    'https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/',
    600,
  );
  const map = new Map<number, number>();
  (data?.response?.ranks || []).forEach((r: any) =>
    map.set(Number(r.appid), Number(r.peak_in_game) || 0),
  );
  return map;
}

// Steam appid → игра IGDB. Два запроса: external_games (appid → id игры), затем games.
async function matchIgdb(entries: SteamEntry[]): Promise<Map<number, Game>> {
  const out = new Map<number, Game>();
  if (entries.length === 0) return out;

  const uids = entries.map((e) => `"${e.appid}"`).join(',');
  const ext = await igdbQuery<{ game?: number; uid: string }[]>(
    'external_games',
    `fields game, uid; where external_game_source = 1 & uid = (${uids}); limit 500;`,
  );

  const gameIdByApp = new Map<number, number>();
  ext.forEach((e) => {
    if (e.game) gameIdByApp.set(Number(e.uid), e.game);
  });

  const ids = [...new Set(gameIdByApp.values())];
  if (ids.length === 0) return out;

  const raw = await igdbQuery<IgdbGame[]>(
    'games',
    `${IGDB_GAME_FIELDS} where id = (${ids.join(',')}); limit ${ids.length};`,
  );
  const byId = new Map(raw.map((g) => [g.id, mapIgdbGame(g)]));

  gameIdByApp.forEach((gameId, appid) => {
    const g = byId.get(gameId);
    if (g) out.set(appid, g);
  });
  return out;
}

// Запасной источник: популярные игры со Steam-страницей, вышедшие за последние ~4 месяца
async function fromIgdbRecent(limit: number): Promise<Game[]> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - 120 * 24 * 3600;
  const raw = await igdbQuery<IgdbGame[]>(
    'games',
    `${IGDB_GAME_FIELDS}
     where game_type = 0 & cover != null & first_release_date >= ${from} & first_release_date <= ${now}
       & external_games.external_game_source = 1;
     sort total_rating_count desc;
     limit ${limit};`,
  );
  return raw.filter((g) => !g.version_parent && !isEdition(g.name)).map(mapIgdbGame);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || '24'), 1), 40);

  if (listCache && Date.now() < listCache.expiresAt && listCache.data.length >= Math.min(limit, 10)) {
    return NextResponse.json(
      { results: listCache.data.slice(0, limit), updatedAt: listCache.expiresAt - CACHE_TTL },
      { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' } },
    );
  }

  try {
    const entries = await fromSteamNewPopular(limit);
    const out: SteamGame[] = [];

    if (entries.length > 0) {
      const [players, matched] = await Promise.all([
        playersFromChart(),
        matchIgdb(entries).catch((err) => {
          console.error('Steam popular: IGDB match error:', err);
          return new Map<number, Game>();
        }),
      ]);

      const seen = new Set<number>();
      const minYear = new Date().getFullYear() - 2; // защита от неверного совпадения со старой игрой

      for (const e of entries) {
        const g = matched.get(e.appid);
        if (!g || seen.has(g.id) || !g.cover) continue;
        if ((g.year || 9999) < minYear) continue;
        seen.add(g.id);
        out.push({ ...g, steam: { appid: e.appid, players: 0, rank: out.length + 1 } });
      }

      // Онлайн для каждой игры: сначала живой счётчик Steam, если его нет — пик из чарта
      await Promise.all(
        out.map(async (g) => {
          const live = await currentPlayers(g.steam.appid);
          g.steam.players = live || players.get(g.steam.appid) || 0;
        }),
      );
    }

    // Steam не ответил или совпадений мало — берём популярные новинки из IGDB
    if (out.length < 8) {
      const recent = await fromIgdbRecent(limit).catch(() => [] as Game[]);
      const seen = new Set(out.map((g) => g.id));
      recent.forEach((g) => {
        if (seen.has(g.id)) return;
        seen.add(g.id);
        out.push({ ...g, steam: { appid: 0, players: 0, rank: out.length + 1 } });
      });
    }

    if (out.length > 0) {
      listCache = { data: out, expiresAt: Date.now() + CACHE_TTL };
    } else if (listCache) {
      return NextResponse.json({ results: listCache.data.slice(0, limit), stale: true });
    }

    return NextResponse.json(
      { results: out.slice(0, limit), updatedAt: Date.now() },
      { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' } },
    );
  } catch (error) {
    console.error('Steam popular error:', error);
    if (listCache) return NextResponse.json({ results: listCache.data.slice(0, limit), stale: true });
    return NextResponse.json({ results: [] });
  }
}
