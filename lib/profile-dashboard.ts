import type { Game, GameData } from '@/types/game';
import { aspectsFromRow } from '@/lib/aspects';

export interface DashboardGameRow {
  game_id: number;
  status: GameData['status'];
  hours: number;
  rating: number;
  rate_gameplay?: number | null;
  rate_story?: number | null;
  rate_visuals?: number | null;
  rate_music?: number | null;
}

export const DASHBOARD_STATUSES = [
  { key: 'completed', label: 'Пройдено', color: '#34d399' },
  { key: 'playing', label: 'Играю', color: '#818cf8' },
  { key: 'want', label: 'Хочу пройти', color: '#e879f9' },
  { key: 'dropped', label: 'Заброшено', color: '#fb7185' },
  { key: 'none', label: 'Без статуса', color: '#737373' },
] as const;

/** Данные всегда считаются по всей библиотеке, независимо от фильтров коллекции. */
export function buildProfileDashboard(games: Game[], userGames: DashboardGameRow[]) {
  const byId = new Map(games.map((g) => [g.id, g]));
  const unique = new Map(userGames.map((g) => [g.game_id, g]));
  const entries = [...unique.values()].map((row) => ({
    id: row.game_id,
    game: byId.get(row.game_id),
    title: byId.get(row.game_id)?.title || `Игра #${row.game_id}`,
    status: DASHBOARD_STATUSES.some((s) => s.key === row.status) ? row.status : 'none' as const,
    hours: Number.isFinite(row.hours) ? Math.max(0, row.hours) : 0,
    rating: Number.isFinite(row.rating) && row.rating >= 1 && row.rating <= 10 ? row.rating : 0,
    aspects: aspectsFromRow(row),
  }));
  const collection = entries.filter((g) => g.status !== 'want');
  const rated = entries.filter((g) => g.rating > 0);
  const timed = entries.filter((g) => g.hours > 0);
  const totalHours = entries.reduce((sum, g) => sum + g.hours, 0);
  const statuses = DASHBOARD_STATUSES.map((s) => ({ ...s, count: entries.filter((g) => g.status === s.key).length }));
  const completed = statuses.find((s) => s.key === 'completed')!.count;
  const started = entries.filter((g) => ['completed', 'playing', 'dropped'].includes(g.status)).length;
  const genreCounts = new Map<string, number>();
  let gamesWithGenres = 0;
  for (const entry of collection) {
    const names = new Set(entry.game?.genres?.map((g) => g.name).filter(Boolean) || []);
    if (names.size === 0 && entry.game?.genre && entry.game.genre !== 'Неизвестно') names.add(entry.game.genre);
    if (names.size > 0) gamesWithGenres++;
    names.forEach((genre) => genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1));
  }
  return {
    entries,
    collectionCount: collection.length,
    totalHours,
    timedCount: timed.length,
    ratedCount: rated.length,
    averageRating: rated.length ? rated.reduce((sum, g) => sum + g.rating, 0) / rated.length : null,
    averageHours: timed.length ? totalHours / timed.length : 0,
    completed,
    started,
    completionRate: started ? Math.round(completed / started * 100) : 0,
    statuses,
    distribution: Array.from({ length: 10 }, (_, i) => ({ rating: i + 1, count: rated.filter((g) => Math.round(g.rating) === i + 1).length })),
    genres: [...genreCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru')).slice(0, 6),
    gamesWithGenres,
    topHours: [...timed].sort((a, b) => b.hours - a.hours || a.id - b.id).slice(0, 5),
    topRated: [...rated].sort((a, b) => b.rating - a.rating || b.hours - a.hours || a.id - b.id).slice(0, 5),
  };
}

export type DashboardEntry = ReturnType<typeof buildProfileDashboard>['entries'][number];
