'use client';

import { useEffect, useRef, useState } from 'react';
import GameImage from '@/components/GameImage';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import type { Game } from '@/types/game';
import { thumbUrl } from '@/lib/images';

interface GameSeriesProps {
  gameId: number;
  /** Открыть выбранную игру серии (та же карточка, без закрытия окна) */
  onOpen: (game: Game) => void;
}

// Кэш на время сессии: повторное открытие карточки не дёргает сеть
const cache = new Map<number, Game[]>();

// Окно карточки прокручивается: после перехода на другую игру возвращаем его наверх
function scrollModalToTop(from: HTMLElement | null) {
  let el = from?.parentElement || null;
  while (el) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) {
      el.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    el = el.parentElement;
  }
}

export default function GameSeries({ gameId, onOpen }: GameSeriesProps) {
  const [items, setItems] = useState<Game[]>(cache.get(gameId) || []);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cached = cache.get(gameId);
    if (cached) {
      setItems(cached);
      return;
    }
    setItems([]);
    let cancelled = false;
    fetch(`/api/games/${gameId}/series`)
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((data) => {
        if (cancelled) return;
        const list: Game[] = data.results || [];
        cache.set(gameId, list);
        setItems(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  const updateArrows = () => {
    const el = scroller.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = 0;
    updateArrows();
    window.addEventListener('resize', updateArrows);
    return () => window.removeEventListener('resize', updateArrows);
  }, [items]);

  if (items.length === 0) return null;

  const scrollBy = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <div className="bg-neutral-800 rounded-xl p-4 md:p-5">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="font-semibold text-white text-sm md:text-base flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-500" />
          Игры серии
          <span className="text-[11px] font-normal text-neutral-500">{items.length}</span>
        </h3>
        {/* Стрелки нужны на ПК; на телефоне листается пальцем */}
        <div className="hidden md:flex items-center gap-1">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            disabled={!canLeft}
            aria-label="Назад"
            className="w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500 disabled:opacity-30 disabled:cursor-default flex items-center justify-center transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            disabled={!canRight}
            aria-label="Вперёд"
            className="w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500 disabled:opacity-30 disabled:cursor-default flex items-center justify-center transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative -mx-1">
        <div
          ref={scroller}
          onScroll={updateArrows}
          className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory scroll-smooth px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((g) => {
            const year = g.released?.split('-')[0];
            return (
              <button
                key={g.id}
                type="button"
                onClick={(e) => {
                  scrollModalToTop(e.currentTarget);
                  onOpen(g);
                }}
                title={g.title}
                className="group snap-start flex-shrink-0 w-[132px] sm:w-[148px] text-left rounded-lg bg-neutral-900 border border-neutral-700/70 hover:border-indigo-500/60 overflow-hidden transition hover:-translate-y-0.5"
              >
                <div className="relative aspect-[460/215] bg-neutral-800 overflow-hidden">
                  <GameImage
                    src={thumbUrl(g.cover)}
                    fallback={thumbUrl(g.coverAlt)}
                    alt={g.title}
                    fill
                    sizes="148px"
                    className="object-cover transition duration-500 group-hover:scale-105"
                    unoptimized
                    loading="lazy"
                  />
                </div>
                <div className="px-2 py-1.5">
                  <div className="text-[11px] font-medium text-neutral-200 leading-tight line-clamp-1 group-hover:text-white">
                    {g.title}
                  </div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">{year || '—'}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Подсказка «есть ещё» — затухание у края */}
        {canRight && (
          <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-neutral-800 to-transparent" />
        )}
        {canLeft && (
          <div className="pointer-events-none absolute left-0 top-0 bottom-1 w-8 bg-gradient-to-r from-neutral-800 to-transparent" />
        )}
      </div>
    </div>
  );
}
