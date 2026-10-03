import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.RAWG_API_KEY || 'demo';
const BASE_URL = 'https://api.rawg.io/api';

const FIELDS = [
  'id', 'name', 'background_image', 'released', 'rating',
  'metacritic', 'genres', 'platforms', 'playtime', 'ratings_count',
].join(',');

// In-memory кеш на сервере (живёт между запросами в рамках процесса)
const memCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 минут

const TOO_MAINSTREAM = new Set<number>([
  3498, 4200, 3328, 13536, 4291, 12020, 5286, 5679, 3439, 278, 1942,
]);

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function shuffle<T>(arr: T[], seed: string): T[] {
  let s = hashSeed(seed);
  const r = [...arr];
  for (let i = r.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const allIds = (searchParams.get('all') || '').split(',').filter(Boolean);
  const topIds = (searchParams.get('top') || '').split(',').filter(Boolean);
  const seedParam = searchParams.get('seed') || String(Date.now());

  try {
    const excludeSet = new Set(allIds.map(Number));

    // Ключ кеша — только от topIds (жанры/теги не зависят от seed)
    const topKey = topIds.slice(0, 8).sort().join('-');
    const cacheKey = `pool:${topKey}`;
    const cached = memCache.get(cacheKey);

    let pool: any[] = [];

    if (cached && Date.now() < cached.expiresAt) {
      pool = cached.data;
    } else {
      // 1. Жанры — ОДИН параллельный запрос для всех топ-игр
      let topGenres: string[] = [];

      if (topIds.length > 0) {
        const sample = topIds.slice(0, 8).join(',');
        // RAWG позволяет через запятую НЕ передавать, поэтому берём по одной, но параллельно
        const genreResults = await Promise.all(
          topIds.slice(0, 6).map(async (id) => {
            try {
              const r = await fetch(
                `${BASE_URL}/games/${id}?key=${API_KEY}&fields=genres`,
                { next: { revalidate: 86400 } },
              );
              if (!r.ok) return null;
              return await r.json();
            } catch {
              return null;
            }
          }),
        );

        const genreCount: Record<string, number> = {};
        genreResults.forEach((g) => {
          g?.genres?.forEach((genre: any) => {
            const key = String(genre.id);
            genreCount[key] = (genreCount[key] || 0) + 1;
          });
        });

        topGenres = Object.entries(genreCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([id]) => id);
      }

      // 2. Пул игр — 2 источника параллельно (вместо 6)
      const candidateMap = new Map<number, any>();
      const fetches: Promise<void>[] = [];

      // Источник A: по жанрам, топ по рейтингу
      if (topGenres.length > 0) {
        fetches.push(
          (async () => {
            const url = `${BASE_URL}/games?key=${API_KEY}&genres=${topGenres.join(',')}&ordering=-rating&page_size=40&language=rus&fields=${FIELDS}`;
            const res = await fetch(url, { next: { revalidate: 1800 } });
            if (!res.ok) return;
            const data = await res.json();
            (data.results || []).forEach((g: any) => {
              if (!excludeSet.has(g.id) && !TOO_MAINSTREAM.has(g.id)) {
                candidateMap.set(g.id, g);
              }
            });
          })(),
        );
      }

      // Источник B: топ по метакритике глобально (fallback + разнообразие)
      fetches.push(
        (async () => {
          const url = `${BASE_URL}/games?key=${API_KEY}&ordering=-metacritic&page_size=40&language=rus&fields=${FIELDS}`;
          const res = await fetch(url, { next: { revalidate: 1800 } });
          if (!res.ok) return;
          const data = await res.json();
          (data.results || []).forEach((g: any) => {
            if (!excludeSet.has(g.id) && !TOO_MAINSTREAM.has(g.id) && g.metacritic) {
              candidateMap.set(g.id, g);
            }
          });
        })(),
      );

      await Promise.all(fetches);

      const now = new Date().getFullYear();
      pool = Array.from(candidateMap.values()).sort((a, b) => {
        const scoreA = (a.metacritic || 0) * 0.5 + (a.rating || 0) * 10 + Math.max(0, 30 - (now - (Number(a.released?.split('-')[0]) || now)) * 2);
        const scoreB = (b.metacritic || 0) * 0.5 + (b.rating || 0) * 10 + Math.max(0, 30 - (now - (Number(b.released?.split('-')[0]) || now)) * 2);
        return scoreB - scoreA;
      }).slice(0, 50);

      memCache.set(cacheKey, { data: pool, expiresAt: Date.now() + CACHE_TTL });
    }

    // Shuffle только на выдаче (пул кешируется без seed)
    const shuffled = shuffle(pool, seedParam);
    const results = shuffled.slice(0, 8);

    return NextResponse.json(
      { results, poolSize: pool.length },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      },
    );
  } catch (error) {
    console.error('For You error:', error);
    return NextResponse.json({ results: [] });
  }
}