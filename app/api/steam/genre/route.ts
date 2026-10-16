import { NextRequest, NextResponse } from 'next/server';
import { igdbQuery, mapIgdbGame, IgdbGame } from '@/lib/igdb';
import { IGDB_GAME_FIELDS } from '@/lib/igdb-shared';
import { matchSteamApps } from '@/lib/igdb-steam';
import { GENRE_IDS, STEAM_TAGS, matchesGenre, isFreshEnough } from '@/lib/genre-rules';
import type { Game } from '@/types/game';
import { applyOverrides } from '@/lib/overrides';

// Страница каталога «Популярные в Steam». Берём настоящий список Steam («Лидеры продаж»,
// внутри жанра — по его тегу), сверяем с IGDB и оставляем только свежие игры нужного жанра.
const STEAM_BATCH = 60; // сколько позиций Steam просматриваем за страницу
const LIVE_TOP = 30; // старые игры допускаем, только если они в топе по онлайну прямо сейчас
const CACHE_TTL = 30 * 60 * 1000;

const cache = new Map<string, { at: number; body: { results: Game[]; next: boolean } }>();
let chartCache: { at: number; ids: Set<number> } | null = null;

const NOT_A_GAME = /\b(Deluxe|Ultimate|Premium|Collector'?s|Gold|Definitive|Complete)\s+Edition\b|\bBundle\b|\bSoundtrack\b|\bDLC\b/i;

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

async function steamTopSellers(tag: string, start: number): Promise<number[]> {
  const data = await getJson(
    `https://store.steampowered.com/search/results/?query&start=${start}&count=${STEAM_BATCH}&filter=topsellers&category1=998${tag ? `&tags=${tag}` : ''}&json=1&cc=us&l=english`,
    900,
  );
  const items: any[] = data?.items || [];
  const out: number[] = [];
  for (const it of items) {
    const m = String(it?.logo || '').match(/\/apps\/(\d+)\//);
    if (m) out.push(Number(m[1]));
  }
  return out;
}

// Самые играемые прямо сейчас (чарт Steam) — им разрешаем быть «старше»
async function liveChart(): Promise<Set<number>> {
  if (chartCache && Date.now() - chartCache.at < 10 * 60 * 1000) return chartCache.ids;
  const data = await getJson('https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/', 600);
  const ids = new Set<number>(((data?.response?.ranks || []) as any[]).slice(0, LIVE_TOP).map((r) => Number(r.appid)));
  chartCache = { at: Date.now(), ids };
  return ids;
}

// Запасной вариант, если Steam не ответил: свежие популярные игры из IGDB
async function igdbFallback(genre: string, page: number): Promise<Game[]> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - 5 * 365 * 24 * 3600;
  const where = [
    'game_type = 0',
    'cover != null',
    'version_parent = null',
    `first_release_date >= ${from}`,
    `first_release_date <= ${now}`,
    'total_rating_count >= 15',
    'external_games.external_game_source = 1',
  ];
  const ids = GENRE_IDS[genre];
  if (ids) where.push(`genres = (${ids.join(',')})`);

  const raw = await igdbQuery<IgdbGame[]>(
    'games',
    `${IGDB_GAME_FIELDS} where ${where.join(' & ')}; sort total_rating_count desc; limit 50; offset ${(page - 1) * 50};`,
    CACHE_TTL,
  );
  return raw.filter((g) => matchesGenre(g, genre) && !NOT_A_GAME.test(g.name)).map(mapIgdbGame);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const genre = (searchParams.get('genre') || '').replace(/[^a-z0-9-]/gi, '');
  const page = Math.max(1, Math.min(Number(searchParams.get('page') || '1') || 1, 20));

  const key = `${genre}:${page}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) {
    return NextResponse.json(hit.body, { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' } });
  }

  try {
    const appids = await steamTopSellers(STEAM_TAGS[genre] || '', (page - 1) * STEAM_BATCH);
    let results: Game[] = [];
    let next = appids.length >= STEAM_BATCH;

    if (appids.length > 0) {
      const [matched, live] = await Promise.all([matchSteamApps(appids), liveChart()]);
      const seen = new Set<number>();

      for (const appid of appids) {
        const raw = matched.get(appid);
        if (!raw || seen.has(raw.id)) continue;
        if (raw.version_parent || NOT_A_GAME.test(raw.name)) continue;
        if (raw.game_type !== undefined && ![0, 8, 9].includes(raw.game_type)) continue;

        const g = mapIgdbGame(raw);
        if (!g.cover) continue;
        if (genre && !matchesGenre(raw, genre)) continue;
        // свежесть: недавние игры, а старые — только если их сейчас массово играют
        if (!isFreshEnough(g.year) && !live.has(appid)) continue;

        seen.add(raw.id);
        results.push(g);
      }
    } else {
      results = await igdbFallback(genre, page);
      next = results.length >= 20;
    }

    results = await applyOverrides(results);
    const body = { results, next };
    if (results.length > 0) cache.set(key, { at: Date.now(), body });
    return NextResponse.json(body, { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' } });
  } catch (error) {
    console.error('Steam genre error:', error);
    // Пустой ответ: фронт сам упадёт в запасной вариант (/api/games)
    return NextResponse.json({ results: [], next: false });
  }
}
