import { NextRequest, NextResponse } from 'next/server';
import { mapRawgGame, RawgGame } from '@/lib/rawg';

const RAWG_API_KEY = process.env.RAWG_API_KEY || 'demo';
const RAWG_BASE = 'https://api.rawg.io/api';

const STEAM_FEATURED_URL =
  'https://store.steampowered.com/api/featuredcategories?cc=ru&l=russian';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SteamTopGame {
  appid: number;
  name: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') || '20'), 30);
  const force = searchParams.get('force') === '1';

  try {
    const steamRes = await fetch(STEAM_FEATURED_URL, {
      next: force ? { revalidate: 0 } : { revalidate: 86400 },
    });

    if (!steamRes.ok) {
      return NextResponse.json({ error: 'Steam API failed' }, { status: 502 });
    }

    const data = await steamRes.json();
    const topSellers = data?.top_sellers?.items || [];

    if (!topSellers.length) {
      return NextResponse.json({ results: [] });
    }

    const topGames: SteamTopGame[] = topSellers
      .slice(0, limit)
      .map((g: any): SteamTopGame => ({
        appid: g.id,
        name: g.name,
      }))
      .filter((g: SteamTopGame) => g.name);

    const games: RawgGame[] = [];
    const concurrency = 4;

    for (let i = 0; i < topGames.length; i += concurrency) {
      const batch = topGames.slice(i, i + concurrency);
      const results = await Promise.all(
        batch.map(async ({ name }: SteamTopGame) => {
          try {
            const cleanName = name
              .replace(/™|®/g, '')
              .replace(/\s+/g, ' ')
              .trim();

            const searchUrl = `${RAWG_BASE}/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(cleanName)}&page_size=1`;
            const res = await fetch(searchUrl, {
              next: { revalidate: 86400 },
            });
            if (!res.ok) return null;
            const data = await res.json();
            return data.results?.[0] || null;
          } catch {
            return null;
          }
        }),
      );
      games.push(...results.filter(Boolean) as RawgGame[]);
      await sleep(250);
    }

    const mappedGames = games.map((g: RawgGame) => mapRawgGame(g));

    const seen = new Set<number>();
    const orderedGames = topGames
      .map(({ name }: SteamTopGame) => {
        const clean = name
          .replace(/™|®/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
        return mappedGames.find((m) => {
          const title = m.title.toLowerCase();
          return title.includes(clean) || clean.includes(title);
        });
      })
      .filter((g): g is ReturnType<typeof mapRawgGame> => {
        if (!g) return false;
        if (seen.has(g.id)) return false;
        seen.add(g.id);
        return true;
      });

    return NextResponse.json(
      {
        results: orderedGames,
        source: 'steam-top-sellers',
        updatedAt: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
        },
      },
    );
  } catch (error) {
    console.error('Steam popular error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}