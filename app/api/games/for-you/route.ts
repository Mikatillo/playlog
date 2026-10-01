import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.RAWG_API_KEY || 'demo';
const BASE_URL = 'https://api.rawg.io/api';

const FIELDS = [
  'id', 'name', 'background_image', 'released', 'rating',
  'metacritic', 'genres', 'tags', 'platforms', 'playtime',
  'ratings_count', 'added',
].join(',');

const TOO_MAINSTREAM = new Set<number>([
  3498, 4200, 3328, 13536, 4291, 12020, 5286, 5679, 3439, 278, 1942,
]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const allIds = (searchParams.get('all') || '').split(',').filter(Boolean);
  const topIds = (searchParams.get('top') || '').split(',').filter(Boolean);
  const seedParam = searchParams.get('seed') || String(Date.now());

  // Seed превращаем в число для ротации
  const seedNum = hashSeed(seedParam);

  try {
    const excludeSet = new Set(allIds.map(Number));

    // 1. Собираем жанры и теги из топовых игр
    const genreCount: Record<string, { count: number }> = {};
    const tagCount: Record<string, { count: number }> = {};

    if (topIds.length > 0) {
      const sample = topIds.slice(0, 8);
      await Promise.all(
        sample.map(async (id) => {
          try {
            const r = await fetch(
              `${BASE_URL}/games/${id}?key=${API_KEY}&fields=genres,tags`,
              { next: { revalidate: 86400 } },
            );
            if (!r.ok) return;
            const d = await r.json();
            d?.genres?.forEach((g: any) => {
              const key = String(g.id);
              if (!genreCount[key]) genreCount[key] = { count: 0 };
              genreCount[key].count += 1;
            });
            d?.tags?.slice(0, 12).forEach((t: any) => {
              const key = String(t.id);
              if (!tagCount[key]) tagCount[key] = { count: 0 };
              tagCount[key].count += 1;
            });
          } catch {}
        }),
      );
    }

    const allGenres = Object.entries(genreCount)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([id]) => id);
    const allTags = Object.entries(tagCount)
      .filter(([, v]) => v.count >= 2)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([id]) => id);

    // Ротация: каждый раз берём "сдвинутое окно" жанров и тегов
    // Например, если всего 5 жанров — берём 3, но со сдвигом
    const rotate = <T>(arr: T[], size: number, offset: number): T[] => {
      if (arr.length === 0) return [];
      const start = offset % arr.length;
      const result: T[] = [];
      for (let i = 0; i < size && i < arr.length; i++) {
        result.push(arr[(start + i) % arr.length]);
      }
      return result;
    };

    const topGenres = rotate(allGenres, 3, seedNum);
    const topTags = rotate(allTags, 4, seedNum + 1);

    // 2. Собираем кандидатов из РАЗНЫХ источников, каждый со своей сортировкой
    const candidateMap = new Map<number, any>();
    const fetches: Promise<void>[] = [];

    // Источник A: жанры, топ по рейтингу
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

    // Источник B: жанры, сортировка по metacritic
    if (topGenres.length > 0) {
      fetches.push(
        (async () => {
          const url = `${BASE_URL}/games?key=${API_KEY}&genres=${topGenres.join(',')}&ordering=-metacritic&page_size=40&language=rus&fields=${FIELDS}`;
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
    }

    // Источник C: теги (если есть)
    if (topTags.length > 0) {
      fetches.push(
        (async () => {
          const url = `${BASE_URL}/games?key=${API_KEY}&tags=${topTags.join(',')}&ordering=-rating&page_size=40&language=rus&fields=${FIELDS}`;
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

    // Источник D: жанры, свежие игры
    if (topGenres.length > 0) {
      fetches.push(
        (async () => {
          const url = `${BASE_URL}/games?key=${API_KEY}&genres=${topGenres.join(',')}&ordering=-released&page_size=30&language=rus&fields=${FIELDS}`;
          const res = await fetch(url, { next: { revalidate: 1800 } });
          if (!res.ok) return;
          const data = await res.json();
          const now = new Date().getFullYear();
          (data.results || []).forEach((g: any) => {
            const year = Number(g.released?.split('-')[0]) || 0;
            if (
              !excludeSet.has(g.id) &&
              !TOO_MAINSTREAM.has(g.id) &&
              year >= now - 10
            ) {
              candidateMap.set(g.id, g);
            }
          });
        })(),
      );
    }

    // Источник E: одна случайная страница из популярного (для разнообразия)
    fetches.push(
      (async () => {
        const page = (seedNum % 5) + 1;
        const url = `${BASE_URL}/games?key=${API_KEY}&ordering=-added&page_size=40&page=${page}&language=rus&fields=${FIELDS}`;
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

    // Источник F: глобальный топ по метакритике (для случая "нет истории")
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

    let candidates = Array.from(candidateMap.values());

    // Сортируем по "интересности"
    const now = new Date().getFullYear();
    candidates.sort((a, b) => score(b, now) - score(a, now));

    // Берём топ-60 (не 25 — больше пул для shuffle)
    const topCandidates = candidates.slice(0, 60);
    const shuffled = shuffle(topCandidates, seedParam);

    return NextResponse.json({
      results: shuffled.slice(0, 8),
      genres: topGenres,
      tags: topTags,
      poolSize: candidates.length,
    });
  } catch (error) {
    console.error('For You error:', error);
    return NextResponse.json({ results: [] });
  }
}

function score(game: any, currentYear: number): number {
  let s = 0;
  if (game.metacritic) s += game.metacritic * 0.5;
  if (game.rating) s += game.rating * 10;
  const year = Number(game.released?.split('-')[0]) || 0;
  if (year) {
    const age = currentYear - year;
    s += Math.max(0, 30 - age * 2);
  }
  if (game.ratings_count && game.ratings_count > 3000) {
    s -= 20;
  }
  return s;
}

function hashSeed(seed: string): number {
  let s = 0;
  for (let i = 0; i < seed.length; i++) {
    s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return s;
}

function shuffle<T>(arr: T[], seed: string): T[] {
  let s = hashSeed(seed);
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}