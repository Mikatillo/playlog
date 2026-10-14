'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import GameImage from '@/components/GameImage';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Game, GameData } from '@/types/game';

interface RailProps {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  /** меняется — лента возвращается в начало */
  resetKey?: string | number;
}

/** Горизонтальная лента: свайп на телефоне, стрелки на ПК, затухание по краям */
export function Rail({ title, subtitle, action, children, resetKey }: RailProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = 0;
    update();
    const t = setTimeout(update, 300);
    window.addEventListener('resize', update);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', update);
    };
  }, [resetKey]);

  const by = (dir: 1 | -1) =>
    ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: 'smooth' });

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">{title}</h2>
          {subtitle && <p className="text-xs md:text-sm text-neutral-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {action}
          <div className="hidden md:flex items-center gap-1">
            <button
              type="button"
              onClick={() => by(-1)}
              disabled={!canLeft}
              aria-label="Назад"
              className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-600 disabled:opacity-30 disabled:cursor-default flex items-center justify-center transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => by(1)}
              disabled={!canRight}
              aria-label="Вперёд"
              className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-600 disabled:opacity-30 disabled:cursor-default flex items-center justify-center transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="relative -mx-4 md:mx-0">
        <div
          ref={ref}
          onScroll={update}
          className="no-scrollbar flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth px-4 md:px-0 pb-1"
        >
          {children}
        </div>
        {canRight && (
          <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-10 bg-gradient-to-l from-[#0a0a0a] to-transparent hidden md:block" />
        )}
        {canLeft && (
          <div className="pointer-events-none absolute left-0 top-0 bottom-1 w-10 bg-gradient-to-r from-[#0a0a0a] to-transparent hidden md:block" />
        )}
      </div>
    </section>
  );
}

interface RailCardProps {
  game: Game;
  onClick: () => void;
  /** подпись-плашка поверх картинки (причина рекомендации и т.п.) */
  badge?: string;
  /** строка под названием */
  meta?: string;
  userData?: GameData;
  priority?: boolean;
}

export function RailCard({ game, onClick, badge, meta, userData, priority }: RailCardProps) {
  const saved = userData && userData.status !== 'none';
  return (
    <button
      type="button"
      onClick={onClick}
      className="group snap-start flex-shrink-0 w-[236px] md:w-[272px] text-left rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 hover:border-indigo-500/50 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10"
    >
      <div className="relative aspect-[460/215] bg-neutral-800 overflow-hidden">
        <GameImage
          src={game.cover || 'https://via.placeholder.com/400x225/171717/525252?text=No+Image'}
          fallback={game.coverAlt}
          smart
          alt={game.title}
          fill
          sizes="272px"
          className="object-cover transition duration-500 group-hover:scale-105"
          unoptimized
          priority={priority}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        {badge && (
          <span className="absolute top-2 left-2 max-w-[85%] truncate text-[10px] font-semibold uppercase tracking-wide text-white bg-indigo-500/85 backdrop-blur px-2 py-0.5 rounded-md">
            {badge}
          </span>
        )}
        {saved && (
          <span className="absolute top-2 right-2 text-[10px] font-semibold text-emerald-300 bg-black/60 backdrop-blur px-1.5 py-0.5 rounded-md">
            В библиотеке
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="text-sm font-semibold text-white truncate group-hover:text-indigo-200 transition">
          {game.title}
        </div>
        <div className="text-xs text-neutral-500 mt-0.5 truncate">
          {meta || [game.genre, game.year || null].filter(Boolean).join(' · ')}
        </div>
      </div>
    </button>
  );
}
