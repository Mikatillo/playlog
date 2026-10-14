import type { IgdbGame } from '@/lib/igdb';

// Жанры IGDB для каждого раздела каталога
export const GENRE_IDS: Record<string, number[]> = {
  action: [4, 5, 8, 25],
  adventure: [31],
  'role-playing-games-rpg': [12],
  strategy: [11, 15, 16, 24],
  shooter: [5],
  puzzle: [9],
  racing: [10],
  sports: [14],
  simulation: [13],
  indie: [32],
};

// Теги Steam (для поиска «Лидеры продаж» внутри жанра)
export const STEAM_TAGS: Record<string, string> = {
  action: '19',
  adventure: '21',
  'role-playing-games-rpg': '122',
  strategy: '9',
  shooter: '1774',
  puzzle: '1664',
  racing: '699',
  sports: '701',
  simulation: '599',
  indie: '492',
};

// «Чужие» жанры: если игра ещё и это, она, скорее всего, не про выбранный жанр
// (например, GTA помечена в IGDB как Racing, но это экшен/шутер)
const CONFLICTS: Record<string, number[]> = {
  racing: [4, 5, 12, 8],
  sports: [5, 12, 4],
  puzzle: [5, 12, 4, 14, 10],
  'role-playing-games-rpg': [10, 14],
  simulation: [5, 4],
  strategy: [5, 10, 14],
};

/** Относится ли игра именно к выбранному жанру (а не просто «содержит» его). */
export function matchesGenre(game: Pick<IgdbGame, 'genres'>, slug: string): boolean {
  const ids = GENRE_IDS[slug];
  if (!ids) return true;
  const own = (game.genres || []).map((g) => g.id);
  if (!own.some((id) => ids.includes(id))) return false;
  const bad = CONFLICTS[slug];
  if (bad && own.some((id) => bad.includes(id))) return false;
  return true;
}

/** Игра достаточно свежая? Старше — только если её сейчас массово играют. */
export function isFreshEnough(year: number, years = 5): boolean {
  if (!year) return false;
  return year >= new Date().getFullYear() - years;
}
