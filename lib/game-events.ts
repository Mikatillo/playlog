'use client';

import { useEffect, useRef } from 'react';
import type { Game } from '@/types/game';

const EVENT = 'playlog:game-updated';

/** Сообщает всем спискам на странице, что карточка игры изменилась (правка админа). */
export function emitGameUpdated(game: Game) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<Game>(EVENT, { detail: game }));
}

/** Подписка списка игр на правки: подменяет изменённую игру прямо в списке, без перезагрузки. */
export function useGameUpdates(onUpdate: (game: Game) => void) {
  const ref = useRef(onUpdate);
  ref.current = onUpdate;
  useEffect(() => {
    const handler = (e: Event) => ref.current((e as CustomEvent<Game>).detail);
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);
}

/** Заменяет игру с тем же id в списке, сохраняя прочие поля элемента (например, причину рекомендации). */
export function patchGameInList<T extends Game>(list: T[], game: Game): T[] {
  return list.map((x) => (x.id === game.id ? { ...x, ...game } : x));
}
