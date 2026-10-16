import { NextRequest, NextResponse } from 'next/server';
import { igdbQuery, igdbMulti, mapIgdbGame, IgdbGame } from '@/lib/igdb';
import { IGDB_GAME_FIELDS, isEdition } from '@/lib/igdb-shared';
import type { Game } from '@/types/game';
import { applyOverrides } from '@/lib/overrides';

const RESULT_COUNT = 12;

// Кэш пула кандидатов (зависит только от вкусов пользователя, не от seed)
const memCache = new Map<string, { data: Candidate[]; expiresAt: number }>();
const CACHE_TTL = 30 * 60 * 1000;

// Игры с огромным числом оценок все и так знают — слегка опускаем их
const MAINSTREAM_RATINGS = 2500;

type Source = 'genre-fresh' | 'genre-top' | 'theme' | 'trending' | 'gems';

interface Candidate {
  raw: IgdbGame;
  game: Game;
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

function ratingsCount(g: IgdbGame): number {
  return g.total_rating_count || g.rating_count || 0;
}

const BASE_WHERE = 'game_type = 0 & cover != null & version_parent = null';

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
    const nowSec = Math.floor(now.getTime() / 1000);
    const yearSec = 365 * 24 * 3600;

    const cacheKey = `pool:${[...topIds].sort((a, b) => a - b).join('-')}`;
    const cached = memCache.get(cacheKey);
    let pool: Candidate[];

    if (cached && Date.now() < cached.expiresAt) {
      pool = cached.data;
    } else {
      // 1. Вкус: жанры и темы любимых игр
      const genreCount = new Map<number, { n: number; name: string }>();
      const themeCount = new Map<number, { n: number; name: string }>();

      if (topIds.length > 0) {
        const liked = await igdbQuery<IgdbGame[]>(
          'games',
          `fields genres.name, themes.name; where id = (${topIds.join(',')}); limit ${topIds.length};`,
          6 * 3600 * 1000,
        );
        liked.forEach((g) => {
          g.genres?.forEach((x) => {
            const e = genreCount.get(x.id) || { n: 0, name: x.name };
            e.n += 1;
            genreCount.set(x.id, e);
          });
          g.themes?.forEach((x) => {
            const e = themeCount.get(x.id) || { n: 0, name: x.name };
            e.n += 1;
            themeCount.set(x.id, e);
          });
        });
      }

      const topGenres = [...genreCount.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 3);
      const topThemes = [...themeCount.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 2);

      // 2. Источники кандидатов — одним запросом /multiquery (у IGDB лимит 4 запроса в секунду)
      const freshFrom = nowSec - 4 * yearSec;
      const midFrom = nowSec - 9 * yearSec;

      const queries: { name: string; endpoint: string; body: string; source: Source }[] = [];

      topGenres.forEach(([id]) => {
        queries.push({
          name: `genre-fresh-${id}`,
          endpoint: 'games',
          source: 'genre-fresh',
          body: `${IGDB_GAME_FIELDS}
            where ${BASE_WHERE} & genres = (${id}) & first_release_date >= ${freshFrom} & first_release_date <= ${nowSec} & total_rating_count >= 15;
            sort total_rating_count desc; limit 30;`,
        });
      });
      topGenres.slice(0, 2).forEach(([id]) => {
        queries.push({
          name: `genre-top-${id}`,
          endpoint: 'games',
          source: 'genre-top',
          body: `${IGDB_GAME_FIELDS}
            where ${BASE_WHERE} & genres = (${id}) & first_release_date >= ${midFrom} & first_release_date <= ${nowSec} & aggregated_rating >= 78 & aggregated_rating_count >= 5;
            sort aggregated_rating desc; limit 30;`,
        });
      });
      topThemes.forEach(([id]) => {
        queries.push({
          name: `theme-${id}`,
          endpoint: 'games',
          source: 'theme',
          body: `${IGDB_GAME_FIELDS}
            where ${BASE_WHERE} & themes = (${id}) & first_release_date >= ${midFrom} & first_release_date <= ${nowSec} & total_rating_count >= 15;
            sort total_rating desc; limit 30;`,
        });
      });
      // Что вышло за последний год и набирает оценки
      queries.push({
        name: 'trending',
        endpoint: 'games',
        source: 'trending',
        body: `${IGDB_GAME_FIELDS}
          where ${BASE_WHERE} & first_release_date >= ${nowSec - yearSec} & first_release_date <= ${nowSec} & total_rating_count >= 5;
          sort total_rating_count desc; limit 40;`,
      });
      // Скрытые жемчужины: высокие оценки, но не мегахиты
      queries.push({
        name: 'gems',
        endpoint: 'games',
        source: 'gems',
        body: `${IGDB_GAME_FIELDS}
          where ${BASE_WHERE} & first_release_date >= ${midFrom} & first_release_date <= ${nowSec} & aggregated_rating >= 80 & total_rating_count >= 15 & total_rating_count <= 500;
          sort aggregated_rating desc; limit 40;`,
      });

      const responses = await igdbMulti<IgdbGame>(queries, CACHE_TTL);

      const map = new Map<number, Candidate>();
      const topGenreIds = new Set(topGenres.map(([id]) => id));
      const topThemeIds = new Set(topThemes.map(([id]) => id));

      queries.forEach((q) => {
        (responses[q.name] || []).forEach((raw) => {
          if (!raw?.id || isEdition(raw.name)) return;
          let c = map.get(raw.id);
          if (!c) {
            c = {
              raw,
              game: mapIgdbGame(raw),
              sources: new Set<Source>(),
              genreHits: (raw.genres || []).filter((x) => topGenreIds.has(x.id)).map((x) => x.name),
              tagHits: (raw.themes || []).filter((x) => topThemeIds.has(x.id)).map((x) => x.name),
            };
            map.set(raw.id, c);
          }
          c.sources.add(q.source);
        });
      });

      pool = [...map.values()];
      if (pool.length > 0) memCache.set(cacheKey, { data: pool, expiresAt: Date.now() + CACHE_TTL });
    }

    // 3. Оценка кандидатов
    const rng = makeRng(seedParam);
    const hasTaste = topIds.length > 0;

    const scored = pool
      .filter((c) => !exclude.has(c.game.id))
      .map((c) => {
        const g = c.game;
        const age = Math.max(0, year - (g.year || year));
        let score = (g.rating || 0) * 12 + (g.metacritic || 0) * 0.25;

        // Свежесть: новое сильно выше, старше 10 лет — штраф
        score += Math.max(0, 28 - age * 4);
        if (age > 10) score -= (g.metacritic || 0) >= 90 ? 12 : 30;
        if (age > 15) score -= 20;

        // Релевантность вкусу
        if (hasTaste) {
          score += c.genreHits.length * 9 + c.tagHits.length * 7;
          if (c.sources.has('theme')) score += 6;
        }
        if (c.sources.has('trending')) score += 10;
        if (c.sources.has('gems')) score += 6;
        // Совпало сразу в нескольких источниках — хороший знак
        score += (c.sources.size - 1) * 4;

        // Слишком заезженные хиты
        if (ratingsCount(c.raw) > MAINSTREAM_RATINGS) score -= 15;

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
        const primary = c.game.genre || '?';
        const fk = franchiseKey(c.game.title);
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
      const primary = chosen.c.game.genre || '?';
      genreUsed.set(primary, (genreUsed.get(primary) || 0) + 1);
      franchiseUsed.add(franchiseKey(chosen.c.game.title));
      if (chosen.age > 10) oldCount++;
      picked.push(chosen);
    }

    const results0 = picked.map(({ c, age }) => {
      let reason = 'Хорошая оценка игроков';
      if (c.tagHits.length > 0) reason = `Тебе близко: ${c.tagHits[0]}`;
      else if (c.genreHits.length > 0) reason = `Любимый жанр: ${c.genreHits[0]}`;
      else if (c.sources.has('trending') && age <= 1) reason = 'Новинка';
      else if (c.sources.has('gems')) reason = 'Скрытая жемчужина';
      else if (c.sources.has('trending')) reason = 'В тренде';
      return { ...c.game, reason };
    });
    const results = await applyOverrides(results0);

    return NextResponse.json(
      { results, poolSize: pool.length },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('For You error:', error);
    return NextResponse.json({ results: [] });
  }
}
