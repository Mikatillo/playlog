import { GameData, XP_RULES } from '@/types/game';

/**
 * Считает, сколько XP нужно начислить за переход из oldData в newData.
 * Возвращает 0, если данные не изменились или изменения уже были учтены.
 */
export function calculateXpGain(
  oldData: GameData | null,
  newData: GameData,
): { amount: number; reasons: string[] } {
  const reasons: string[] = [];
  let amount = 0;

  const hadGame = !!oldData && oldData.status !== 'none';
  const hasGame = newData.status !== 'none';

  // Первое добавление игры (любой статус кроме none)
  if (!hadGame && hasGame) {
    amount += XP_RULES.ADD_GAME;
    reasons.push('Игра добавлена');
  }

  // Первое выставление оценки
  if ((!oldData || oldData.rating === 0) && newData.rating > 0) {
    amount += XP_RULES.RATE;
    reasons.push('Оценка выставлена');
  }

  // Первая рецензия (>10 символов)
  const hadReview = !!oldData && oldData.review.length > 10;
  const hasReview = newData.review.length > 10;
  if (!hadReview && hasReview) {
    amount += XP_RULES.REVIEW;
    reasons.push('Рецензия написана');
  }

  // Первый раз completed
  const wasCompleted = oldData?.status === 'completed';
  const isCompleted = newData.status === 'completed';
  if (!wasCompleted && isCompleted) {
    amount += XP_RULES.COMPLETE;
    reasons.push('Игра пройдена');
  }

  // Первый раз dropped (не считаем, если уже был completed)
  const wasDropped = oldData?.status === 'dropped';
  const isDropped = newData.status === 'dropped';
  if (!wasDropped && isDropped && !wasCompleted && !isCompleted) {
    amount += XP_RULES.DROP;
    reasons.push('Игра заброшена');
  }

  return { amount, reasons };
}
import { COIN_RULES } from '@/types/game';

/**
 * Считает, сколько монет начислить за переход из oldData в newData.
 * Логика повторяет calculateXpGain, но с другими суммами.
 */
export function calculateCoinGain(
  oldData: GameData | null,
  newData: GameData,
): number {
  let amount = 0;

  const hadGame = !!oldData && oldData.status !== 'none';
  const hasGame = newData.status !== 'none';

  if (!hadGame && hasGame) {
    amount += COIN_RULES.ADD_GAME;
  }

  if ((!oldData || oldData.rating === 0) && newData.rating > 0) {
    amount += COIN_RULES.RATE;
  }

  const hadReview = !!oldData && oldData.review.length > 10;
  const hasReview = newData.review.length > 10;
  if (!hadReview && hasReview) {
    amount += COIN_RULES.REVIEW;
  }

  const wasCompleted = oldData?.status === 'completed';
  const isCompleted = newData.status === 'completed';
  if (!wasCompleted && isCompleted) {
    amount += COIN_RULES.COMPLETE;
  }

  const wasDropped = oldData?.status === 'dropped';
  const isDropped = newData.status === 'dropped';
  if (!wasDropped && isDropped && !wasCompleted && !isCompleted) {
    amount += COIN_RULES.DROP;
  }

  return amount;
}