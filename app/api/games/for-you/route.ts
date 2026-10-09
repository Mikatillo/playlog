import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.RAWG_API_KEY || 'demo';
const BASE_URL = 'https://api.rawg.io/api';

const FIELDS = [
  'id', 'name', 'background_image', 'released', 'rating',
  'metacritic', 'genres', 'platforms', 'playtime', 'ratings_count',
].join(',');

// Разные ordering — меняем при каждом обновлении
const ORDERINGS = ['-rating', '-metacritic', '-added', '-released'];

// Разные диапазоны годов
const YEAR_RANGES = [
  '',
  '2015-2020',
  '2010-2015',
  '2005-2010',
  '1998-2005',
  '2020-2026',
];

// In-memory кеш на сервере
const memCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

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

    // Seed превращаем в детерминированные числа — выбор ordering, страниц, годов
    const seedNum = hashSeed(seedParam);
    const ordering = ORDERINGS[seedNum % ORDERINGS.length];
    const pageOffset = (seedNum % 3) + 1; // 1..3 — разные страницы RAWG
    const yearRange = YEAR_RANGES[(seedNum >> 3) % YEAR_RANGES.length];

    // Ключ кеша включает выбор из seed — разные seed = разные пулы
    const topKey = topIds.slice(0, 8).sort().join('-');
    const cacheKey = `pool:${topKey}:${ordering}:${pageOffset}:${yearRange}`;
    const cached = memCache.get(cacheKey);

    let pool: any[] = [];

    if (cached && Date.now() < cached.expiresAt) {
      pool = cached.data;
    } else {
      // 1. Жанры — параллельный запрос для топ-игр
      let topGenres: string[] = [];

      if (topIds.length > 0) {
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

      const candidateMap = new Map<number, any>();
      const fetches: Promise<void>[] = [];

      // Источник A: по жанрам, ordering/страница/годы — из seed
      if (topGenres.length > 0) {
        fetches.push(
          (async () => {
            let url = `${BASE_URL}/games?key=${API_KEY}&genres=${topGenres.join(',')}&ordering=${ordering}&page=${pageOffset}&page_size=40&language=rus&fields=${FIELDS}`;
            if (yearRange) url += `&dates=${yearRange}`;
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

      // Источник B: глобальный, другой ordering и другая страница
      fetches.push(
        (async () => {
          const altOrdering = ORDERINGS[(seedNum + 1) % ORDERINGS.length];
          const altPage = (pageOffset % 3) + 1;
          let url = `${BASE_URL}/games?key=${API_KEY}&ordering=${altOrdering}&page=${altPage}&page_size=40&language=rus&fields=${FIELDS}`;
          if (yearRange) url += `&dates=${yearRange}`;
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

      // Источник C: случайная страница популярных игр — для разнообразия
      fetches.push(
        (async () => {
          const randomPage = (seedNum % 8) + 1; // 1..8
          const url = `${BASE_URL}/games?key=${API_KEY}&ordering=-added&page=${randomPage}&page_size=40&language=rus&fields=${FIELDS}`;
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

      await Promise.all(fetches);

      const now = new Date().getFullYear();
      pool = Array.from(candidateMap.values())
        .sort((a, b) => {
          const scoreA =
            (a.metacritic || 0) * 0.5 +
            (a.rating || 0) * 10 +
            Math.max(0, 30 - (now - (Number(a.released?.split('-')[0]) || now)) * 2);
          const scoreB =
            (b.metacritic || 0) * 0.5 +
            (b.rating || 0) * 10 +
            Math.max(0, 30 - (now - (Number(b.released?.split('-')[0]) || now)) * 2);
          return scoreB - scoreA;
        })
        .slice(0, 150); // пул больше — из него можно выбрать 8 разных

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