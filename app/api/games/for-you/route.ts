import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.RAWG_API_KEY || 'demo';
const BASE_URL = 'https://api.rawg.io/api';

const FIELDS = [
  'id', 'name', 'background_image', 'released', 'rating',
  'metacritic', 'genres', 'tags', 'platforms', 'playtime', 'ratings_count',
].join(',');

const RESULT_COUNT = 12;

// Кэш пула кандидатов (зависит только от вкусов пользователя, не от seed)
const memCache = new Map<string, { data: Candidate[]; expiresAt: number }>();
const CACHE_TTL = 30 * 60 * 1000;

// Совсем «заезженные» игры, которые и так все знают
const TOO_MAINSTREAM = new Set<number>([
  3498, 4200, 3328, 13536, 4291, 12020, 5286, 5679, 3439, 278, 1942,
]);

// Слишком общие теги — по ним нельзя понять вкус
const GENERIC_TAG_LIMIT = 150000; // games_count выше — тег слишком общий

type Source = 'genre-fresh' | 'genre-top' | 'tag' | 'trending' | 'gems';

interface Candidate {
  game: any;
  sources: Set<Source>;
  genreHits: string[];
  tagHits: string[];
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function makeRng(seed: string) {
  let s = hashSeed(seed) || 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function normName(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9а-яё ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Ключ «франшизы»: Assassin's Creed Origins / Odyssey / Valhalla → один ключ
function franchiseKey(name: string): string {
  const n = normName(name).replace(/\b(\d+|i{1,3}|iv|v|vi{1,3}|ix|x)\b/g, ' ').replace(/\s+/g, ' ').trim();
  return n.split(' ').slice(0, 2).join(' ');
}

function yearOf(g: any): number {
  return Number(g.released?.split('-')[0]) || 0;
}

async function getJson(url: string, revalidate = 1800): Promise<any | null> {
  try {
    const res = await fetch(url, { next: { revalidate }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const allIds = (searchParams.get('all') || '').split(',').map(Number).filter(Boolean);
  const topIds = (searchParams.get('top') || '').split(',').map(Number).filter(Boolean).slice(0, 8);
  const seenIds = new Set(
    (searchParams.get('seen') || '').split(',').map(Number).filter(Boolean),
  );
  const seedParam = searchParams.get('seed') || String(Date.now());

  try {
    const exclude = new Set<number>(allIds);
    const now = new Date();
    const year = now.getFullYear();

    const cacheKey = `pool:${[...topIds].sort().join('-')}`;
    const cached = memCache.get(cacheKey);
    let pool: Candidate[];
    let genreNames: Record<string, string> = {};

    if (cached && Date.now() < cached.expiresAt) {
      pool = cached.data;
    } else {
      // 1. Вкус: жанры и теги любимых игр
      const genreCount = new Map<string, { n: number; name: string }>();
      const tagCount = new Map<string, { n: number; name: string }>();

      const details = await Promise.all(
        topIds.map((id) => getJson(`${BASE_URL}/games/${id}?key=${API_KEY}&fields=genres,tags`, 86400)),
      );
      details.forEach((d) => {
        d?.genres?.forEach((g: any) => {
          const e = genreCount.get(String(g.id)) || { n: 0, name: g.name };
          e.n += 1;
          genreCount.set(String(g.id), e);
        });
        d?.tags?.forEach((t: any) => {
          if (!t || (t.games_count || 0) > GENERIC_TAG_LIMIT || (t.games_count || 0) < 800) return;
          if (t.language && t.language !== 'eng') return;
          const e = tagCount.get(String(t.id)) || { n: 0, name: t.name };
          e.n += 1;
          tagCount.set(String(t.id), e);
        });
      });

      const topGenres = [...genreCount.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 3);
      const topTags = [...tagCount.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 3);
      topGenres.forEach(([id, v]) => (genreNames[id] = v.name));

      // 2. Источники кандидатов — всё параллельно, и все свежие
      const freshFrom = `${year - 4}-01-01`;
      const midFrom = `${year - 9}-01-01`;
      const yearAgo = new Date(now.getTime() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const today = now.toISOString().slice(0, 10);
      const lastDay = `${year}-12-31`;

      const jobs: { url: string; source: Source }[] = [];

      topGenres.forEach(([id]) => {
        jobs.push({
          source: 'genre-fresh',
          url: `${BASE_URL}/games?key=${API_KEY}&genres=${id}&dates=${freshFrom},${lastDay}&ordering=-added&page_size=30&fields=${FIELDS}`,
        });
      });
      topGenres.slice(0, 2).forEach(([id]) => {
        jobs.push({
          source: 'genre-top',
          url: `${BASE_URL}/games?key=${API_KEY}&genres=${id}&dates=${midFrom},${lastDay}&metacritic=75,100&ordering=-rating&page_size=30&fields=${FIELDS}`,
        });
      });
      topTags.forEach(([id]) => {
        jobs.push({
          source: 'tag',
          url: `${BASE_URL}/games?key=${API_KEY}&tags=${id}&dates=${midFrom},${lastDay}&ordering=-rating&page_size=30&fields=${FIELDS}`,
        });
      });
      // Что выходит и растёт сейчас
      jobs.push({
        source: 'trending',
        url: `${BASE_URL}/games?key=${API_KEY}&dates=${yearAgo},${today}&ordering=-added&page_size=40&fields=${FIELDS}`,
      });
      // Скрытые жемчужины: высокие оценки, но не мегахиты
      jobs.push({
        source: 'gems',
        url: `${BASE_URL}/games?key=${API_KEY}&dates=${midFrom},${lastDay}&metacritic=80,100&ordering=-rating&page_size=40&fields=${FIELDS}`,
      });

      const responses = await Promise.all(jobs.map((j) => getJson(j.url)));

      const map = new Map<number, Candidate>();
      const topGenreIds = new Set(topGenres.map(([id]) => id));
      const topTagIds = new Map(topTags.map(([id, v]) => [id, v.name]));

      responses.forEach((data, i) => {
        const source = jobs[i].source;
        (data?.results || []).forEach((g: any) => {
          if (!g?.id || !g.background_image || TOO_MAINSTREAM.has(g.id)) return;
          const c = map.get(g.id) || { game: g, sources: new Set<Source>(), genreHits: [], tagHits: [] };
          c.sources.add(source);
          if (c.genreHits.length === 0) {
            c.genreHits = (g.genres || []).filter((x: any) => topGenreIds.has(String(x.id))).map((x: any) => x.name);
          }
          if (c.tagHits.length === 0) {
            c.tagHits = (g.tags || []).filter((t: any) => topTagIds.has(String(t.id))).map((t: any) => t.name);
          }
          map.set(g.id, c);
        });
      });

      pool = [...map.values()];
      memCache.set(cacheKey, { data: pool, expiresAt: Date.now() + CACHE_TTL });
    }

    // 3. Оценка кандидатов
    const rng = makeRng(seedParam);
    const hasTaste = topIds.length > 0;

    const scored = pool
      .filter((c) => !exclude.has(c.game.id))
      .map((c) => {
        const g = c.game;
        const age = Math.max(0, year - (yearOf(g) || year));
        let score = (g.rating || 0) * 12 + (g.metacritic || 0) * 0.25;

        // Свежесть: новое сильно выше, старше 10 лет — штраф
        score += Math.max(0, 28 - age * 4);
        if (age > 10) score -= g.metacritic >= 90 ? 12 : 30;
        if (age > 15) score -= 20;

        // Релевантность вкусу
        if (hasTaste) {
          score += c.genreHits.length * 9 + c.tagHits.length * 7;
          if (c.sources.has('tag')) score += 6;
        }
        if (c.sources.has('trending')) score += 10;
        if (c.sources.has('gems') && (g.ratings_count || 0) < 4000) score += 6;
        // Совпало сразу в нескольких источниках — хороший знак
        score += (c.sources.size - 1) * 4;

        // Уже показывали недавно — пропускаем вперёд новые
        if (seenIds.has(g.id)) score -= 45;

        return { c, score, age };
      });

    // 4. Выбор с разнообразием: штраф за повтор жанра/франшизы, не больше 1 старой игры
    const picked: typeof scored = [];
    const genreUsed = new Map<string, number>();
    const franchiseUsed = new Set<string>();
    let oldCount = 0;
    const remaining = [...scored];

    while (picked.length < RESULT_COUNT && remaining.length > 0) {
      let bestIdx = -1;
      let bestVal = -Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const { c, score, age } = remaining[i];
        const primary = c.game.genres?.[0]?.name || '?';
        const fk = franchiseKey(c.game.name);
        if (franchiseUsed.has(fk)) continue; // одна игра на франшизу
        if (age > 10 && oldCount >= 1) continue;

        const val = score + (rng() - 0.5) * 22 - (genreUsed.get(primary) || 0) * 12;
        if (val > bestVal) {
          bestVal = val;
          bestIdx = i;
        }
      }
      if (bestIdx < 0) break;
      const [chosen] = remaining.splice(bestIdx, 1);
      const primary = chosen.c.game.genres?.[0]?.name || '?';
      genreUsed.set(primary, (genreUsed.get(primary) || 0) + 1);
      franchiseUsed.add(franchiseKey(chosen.c.game.name));
      if (chosen.age > 10) oldCount++;
      picked.push(chosen);
    }

    const results = picked.map(({ c, age }) => {
      let reason = 'Хорошая оценка игроков';
      if (c.tagHits.length > 0) reason = `Тебе близко: ${c.tagHits[0]}`;
      else if (c.genreHits.length > 0) reason = `Любимый жанр: ${c.genreHits[0]}`;
      else if (c.sources.has('trending') && age <= 1) reason = 'Новинка';
      else if (c.sources.has('gems')) reason = 'Скрытая жемчужина';
      else if (c.sources.has('trending')) reason = 'В тренде';
      return { ...c.game, reason };
    });

    return NextResponse.json(
      { results, poolSize: pool.length },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('For You error:', error);
    return NextResponse.json({ results: [] });
  }
}
