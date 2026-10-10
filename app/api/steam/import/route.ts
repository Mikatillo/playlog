import { NextRequest, NextResponse } from 'next/server';
import { requireUser, serverError } from '@/lib/server-auth';

// Импорт идёт порциями: клиент вызывает роут несколько раз (offset),
// поэтому каждый запрос короткий и не обрывается на мобильной сети / лимитах хостинга.
export const maxDuration = 60;

const STEAM_API_KEY = process.env.STEAM_API_KEY;
const RAWG_API_KEY = process.env.RAWG_API_KEY || '';
const RAWG_BASE = 'https://api.rawg.io/api';

const BATCH_SIZE = 8; // игр за один запрос
const CONCURRENCY = 4; // параллельных поисков в RAWG
const MAX_GAMES = 50; // максимум игр за весь импорт
const SHORT_LINK_HOSTS = new Set(['s.team']);

/** Короткая ссылка из мобильного приложения Steam (s.team/p/...) → разворачиваем редиректы. */
async function expandShortLink(url: string): Promise<string | null> {
  try {
    let current = url.startsWith('http') ? url : `https://${url}`;
    for (let i = 0; i < 4; i++) {
      const host = new URL(current).hostname;
      const allowed =
        SHORT_LINK_HOSTS.has(host) ||
        host === 'steamcommunity.com' ||
        host === 'www.steamcommunity.com' ||
        host === 'store.steampowered.com';
      if (!allowed) return null;
      if (host.includes('steamcommunity.com')) return current;
      const res = await fetch(current, { redirect: 'manual' });
      const loc = res.headers.get('location');
      if (!loc) return null;
      current = new URL(loc, current).toString();
    }
  } catch {}
  return null;
}

async function resolveSteamId(input: string): Promise<string | null> {
  let trimmed = input.trim().replace(/\s+/g, '');

  if (/^\d{17}$/.test(trimmed)) return trimmed;

  const hostMatch = trimmed.match(/^(?:https?:\/\/)?(s\.team)\//i);
  if (hostMatch) {
    const expanded = await expandShortLink(trimmed);
    if (!expanded) return null;
    trimmed = expanded;
  }

  const profileMatch = trimmed.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
  if (profileMatch) return profileMatch[1];

  let vanity: string | null = null;
  const idMatch = trimmed.match(/steamcommunity\.com\/id\/([^/?#]+)/i);
  if (idMatch) vanity = idMatch[1];
  if (!vanity && /^[a-zA-Z0-9_-]+$/.test(trimmed)) vanity = trimmed;
  if (!vanity) return null;

  try {
    const res = await fetch(
      `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${STEAM_API_KEY}&vanityurl=${encodeURIComponent(vanity)}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.response?.success === 1 && data.response?.steamid) return data.response.steamid;
  } catch (err) {
    console.error('ResolveVanityURL error:', err);
  }
  return null;
}

async function fetchOwnedGames(steamId: string) {
  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Steam API ${res.status}`);
  const data = await res.json();
  return data.response?.games || [];
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9а-яё]/g, '');

async function findRawgGame(name: string, steamAppId: number): Promise<any | null> {
  try {
    const res = await fetch(
      `${RAWG_BASE}/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(name)}&page_size=5`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const results: any[] = data.results || [];
    if (results.length === 0) return null;

    // Проверяем по Steam appid (параллельно по первым 3 результатам)
    const details = await Promise.all(
      results.slice(0, 3).map(async (game) => {
        try {
          const r = await fetch(`${RAWG_BASE}/games/${game.id}?key=${RAWG_API_KEY}`, {
            next: { revalidate: 86400 },
          });
          if (!r.ok) return null;
          return { game, detail: await r.json() };
        } catch {
          return null;
        }
      }),
    );
    for (const item of details) {
      if (!item) continue;
      const steamStore = item.detail.stores?.find((s: any) => s.store?.id === 1);
      const match = steamStore?.url?.match(/\/app\/(\d+)/);
      if (match && Number(match[1]) === steamAppId) return item.game;
    }

    // Запасной вариант: совпадение по названию
    const target = normalize(name);
    const exact = results.find((g) => normalize(g.name) === target);
    if (exact) return exact;
    const first = results[0];
    if (normalize(first.name).includes(target.slice(0, 5)) && target.length >= 3) return first;
  } catch (err) {
    console.error('RAWG search error:', err);
  }
  return null;
}

export async function POST(request: NextRequest) {
  if (!STEAM_API_KEY) {
    return NextResponse.json(
      { error: 'Steam API key не настроен. Добавьте STEAM_API_KEY в переменные окружения.' },
      { status: 500 },
    );
  }
  if (!RAWG_API_KEY) {
    return NextResponse.json({ error: 'RAWG_API_KEY не настроен на сервере.' }, { status: 500 });
  }

  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { user, db } = auth;
  const userId = user.id;

  try {
    const body = await request.json().catch(() => null);
    const steamUrl = body?.steamUrl;
    const offset = Math.max(0, Math.floor(Number(body?.offset) || 0));

    if (typeof steamUrl !== 'string' || !steamUrl.trim() || steamUrl.length > 300) {
      return NextResponse.json({ error: 'Укажи ссылку на Steam-профиль' }, { status: 400 });
    }

    const steamId = await resolveSteamId(steamUrl);
    if (!steamId) {
      return NextResponse.json(
        { error: 'Не удалось найти Steam-профиль. Проверь ссылку (подойдёт и короткая ссылка из приложения Steam).' },
        { status: 400 },
      );
    }

    if (offset === 0) {
      await db.from('profiles').update({ steam_id: steamId }).eq('id', userId);
    }

    const ownedGames = await fetchOwnedGames(steamId);
    if (ownedGames.length === 0) {
      return NextResponse.json(
        {
          error:
            'Библиотека пуста или закрыта. Открой в Steam: Профиль → Редактировать профиль → Настройки приватности → «Мой профиль» и «Детали игр» = Открытый.',
        },
        { status: 400 },
      );
    }

    const sorted = [...ownedGames]
      .filter((g: any) => g.playtime_forever > 0)
      .sort((a: any, b: any) => b.playtime_forever - a.playtime_forever)
      .slice(0, MAX_GAMES);

    const total = sorted.length;
    const slice = sorted.slice(offset, offset + BATCH_SIZE);

    // Поиск в RAWG — по CONCURRENCY игр одновременно
    const toImport: { rawgId: number; hours: number }[] = [];
    const notFound: string[] = [];
    for (let i = 0; i < slice.length; i += CONCURRENCY) {
      const chunk = slice.slice(i, i + CONCURRENCY);
      const found = await Promise.all(chunk.map((g: any) => findRawgGame(g.name, g.appid)));
      found.forEach((rawg, idx) => {
        const g: any = chunk[idx];
        if (rawg) {
          toImport.push({ rawgId: rawg.id, hours: Math.round(g.playtime_forever / 60) });
        } else {
          notFound.push(g.name);
        }
      });
    }

    let imported = 0;
    let skipped = 0;

    if (toImport.length > 0) {
      const ids = toImport.map((g) => g.rawgId);
      const { data: existing } = await db
        .from('user_games')
        .select('game_id')
        .eq('user_id', userId)
        .in('game_id', ids);
      const existingIds = new Set((existing || []).map((r: any) => r.game_id));

      const seen = new Set<number>();
      const newRows = toImport
        .filter((g) => {
          if (existingIds.has(g.rawgId) || seen.has(g.rawgId)) return false;
          seen.add(g.rawgId);
          return true;
        })
        .map((g) => ({
          user_id: userId,
          game_id: g.rawgId,
          rating: 0,
          hours: Math.min(g.hours, 100000),
          review: '',
          status: 'none' as const,
        }));

      skipped = toImport.length - newRows.length;

      if (newRows.length > 0) {
        const { error: insertError } = await db.from('user_games').insert(newRows);
        if (insertError) return serverError('steam/import insert', insertError);
        imported = newRows.length;
      }
    }

    const nextOffset = offset + slice.length;

    return NextResponse.json({
      imported,
      skipped,
      notFound: notFound.length,
      notFoundTitles: notFound.slice(0, 10),
      total,
      nextOffset,
      done: nextOffset >= total || slice.length === 0,
      totalOwned: ownedGames.length,
      steamId,
    });
  } catch (error) {
    return serverError('steam/import', error);
  }
}
