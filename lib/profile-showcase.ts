import { ACHIEVEMENTS } from '@/lib/achievements';

export const SHOWCASE_METRICS = {
  games: 'Игр в коллекции',
  completed: 'Пройдено игр',
  hours: 'Часов в играх',
  rating: 'Средняя оценка',
  completion: 'Прохождение библиотеки',
  reviews: 'Опубликовано рецензий',
  playing: 'Сейчас играю',
  want: 'В списке желаемого',
} as const;

export type ShowcaseMetric = keyof typeof SHOWCASE_METRICS;
type Visibility = { hidden?: boolean };
export type ShowcaseSlot = Visibility & (
  | { type: 'empty' }
  | { type: 'game'; gameId: number }
  | { type: 'stat'; metric: ShowcaseMetric }
  | { type: 'review'; reviewId: string }
  | { type: 'achievement'; achievementId: string }
);

/** Не допускаем произвольный текст/URL и неизвестные типы в настройках витрины. */
export function parseShowcase(value: unknown): ShowcaseSlot[] | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const result: ShowcaseSlot[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    if (item.hidden !== undefined && typeof item.hidden !== 'boolean') return null;
    const hidden = item.hidden === true;
    switch (item.type) {
      case 'empty': result.push({ type: 'empty', hidden }); break;
      case 'game':
        if (!Number.isSafeInteger(item.gameId) || item.gameId <= 0 || item.gameId > 2147483647) return null;
        result.push({ type: 'game', gameId: item.gameId, hidden }); break;
      case 'stat':
        if (typeof item.metric !== 'string' || !Object.hasOwn(SHOWCASE_METRICS, item.metric)) return null;
        result.push({ type: 'stat', metric: item.metric as ShowcaseMetric, hidden }); break;
      case 'review':
        if (typeof item.reviewId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.reviewId)) return null;
        result.push({ type: 'review', reviewId: item.reviewId, hidden }); break;
      case 'achievement':
        if (!ACHIEVEMENTS.some((a) => a.id === item.achievementId)) return null;
        result.push({ type: 'achievement', achievementId: item.achievementId, hidden }); break;
      default: return null;
    }
  }
  return result;
}

export function initialShowcase(favoriteIds: number[]): ShowcaseSlot[] {
  return Array.from({ length: 4 }, (_, i) => favoriteIds[i]
    ? { type: 'game', gameId: favoriteIds[i] }
    : { type: 'empty' });
}
