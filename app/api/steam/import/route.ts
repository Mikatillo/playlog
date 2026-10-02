import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const STEAM_API_KEY = process.env.STEAM_API_KEY;
const RAWG_API_KEY = process.env.RAWG_API_KEY || 'demo';
const RAWG_BASE = 'https://api.rawg.io/api';

async function resolveSteamId(input: string): Promise<string | null> {
  const trimmed = input.trim();

  if (/^\d{17}$/.test(trimmed)) {
    return trimmed;
  }

  let vanity: string | null = null;

  const idMatch = trimmed.match(/steamcommunity\.com\/id\/([^/?#]+)/);
  if (idMatch) vanity = idMatch[1];

  const profileMatch = trimmed.match(/steamcommunity\.com\/profiles\/(\d{17})/);
  if (profileMatch) return profileMatch[1];

  if (!vanity && /^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    vanity = trimmed;
  }

  if (!vanity) return null;

  try {
    const res = await fetch(
      `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${STEAM_API_KEY}&vanityurl=${encodeURIComponent(vanity)}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.response?.success === 1 && data.response?.steamid) {
      return data.response.steamid;
    }
  } catch (err) {
    console.error('ResolveVanityURL error:', err);
  }
  return null;
}

async function fetchOwnedGames(steamId: string) {
  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Steam API ${res.status}`);
  const data = await res.json();
  return data.response?.games || [];
}

async function findRawgGame(name: string, steamAppId: number): Promise<any | null> {
  try {
    const searchUrl = `${RAWG_BASE}/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(name)}&page_size=5`;
    const res = await fetch(searchUrl, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.results || [];

    for (const game of results) {
      try {
        const detailRes = await fetch(`${RAWG_BASE}/games/${game.id}?key=${RAWG_API_KEY}`, {
          next: { revalidate: 86400 },
        });
        if (!detailRes.ok) continue;
        const detail = await detailRes.json();
        const steamStore = detail.stores?.find((s: any) => s.store?.id === 1);
        if (!steamStore?.url) continue;
        const match = steamStore.url.match(/\/app\/(\d+)/);
        if (match && Number(match[1]) === steamAppId) {
          return game;
        }
      } catch {
        continue;
      }
    }

    if (results.length > 0) {
      const first = results[0];
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalize(first.name).includes(normalize(name).slice(0, 5))) {
        return first;
      }
    }
  } catch (err) {
    console.error('RAWG search error:', err);
  }
  return null;
}

export async function POST(request: NextRequest) {
  if (!STEAM_API_KEY) {
    return NextResponse.json(
      { error: 'Steam API key не настроен. Добавьте STEAM_API_KEY в .env.local и перезапусти сервер.' },
      { status: 500 },
    );
  }

  try {
    const { userId, steamUrl, limit = 50 } = await request.json();

    if (!userId || !steamUrl) {
      return NextResponse.json({ error: 'Missing userId or steamUrl' }, { status: 400 });
    }

    const steamId = await resolveSteamId(steamUrl);
    if (!steamId) {
      return NextResponse.json(
        { error: 'Не удалось найти Steam-профиль. Проверь ссылку.' },
        { status: 400 },
      );
    }

    await supabase.from('profiles').update({ steam_id: steamId }).eq('id', userId);

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
      .slice(0, limit);

    const toImport: { rawgId: number; hours: number; title: string }[] = [];
    const notFound: string[] = [];

    for (const steamGame of sorted) {
      const rawgGame = await findRawgGame(steamGame.name, steamGame.appid);
      if (rawgGame) {
        toImport.push({
          rawgId: rawgGame.id,
          hours: Math.round(steamGame.playtime_forever / 60),
          title: steamGame.name,
        });
      } else {
        notFound.push(steamGame.name);
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    if (toImport.length === 0) {
      return NextResponse.json(
        { error: 'Ни одна игра не найдена в базе RAWG. Попробуй позже.', notFound },
        { status: 400 },
      );
    }

    const rows = toImport.map((g) => ({
      user_id: userId,
      game_id: g.rawgId,
      rating: 0,
      hours: g.hours,
      review: '',
        status: 'none' as const, // Импортированные — как "Играю"
    }));

    const { data: existing } = await supabase
      .from('user_games')
      .select('game_id')
      .eq('user_id', userId);

    const existingIds = new Set((existing || []).map((r: any) => r.game_id));
    const newRows = rows.filter((r) => !existingIds.has(r.game_id));

    if (newRows.length > 0) {
      const { error: insertError } = await supabase.from('user_games').insert(newRows);
      if (insertError) {
        console.error('Insert error:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      imported: newRows.length,
      skipped: rows.length - newRows.length,
      notFound: notFound.length,
      notFoundTitles: notFound.slice(0, 10),
      totalOwned: ownedGames.length,
      steamId,
    });
  } catch (error: any) {
    console.error('[steam/import] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}