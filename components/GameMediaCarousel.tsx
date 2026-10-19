'use client';

import { useEffect, useRef, useState, ReactNode, TouchEvent as ReactTouchEvent } from 'react';
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { Game } from '@/types/game';
import { getMetacriticColor } from '@/lib/utils';

interface GameMediaCarouselProps {
  game: Game;
  onScreenshotClick?: (image: string) => void;
  steamBadge?: ReactNode;
}

type Slide = {
  type: 'cover' | 'screenshot';
  image: string;
  id?: number;
};

export default function GameMediaCarousel({
  game,
  onScreenshotClick,
  steamBadge,
}: GameMediaCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const slides: Slide[] = [
    // Показываем ту же обложку, что и в редакторе; арт IGDB — только запасной вариант.
    { type: 'cover', image: game.cover || game.coverHD || '' },
    ...(game.screenshots || []).map((s) => ({
      type: 'screenshot' as const,
      image: s.image,
      id: s.id,
    })),
  ];

  useEffect(() => {
    setCurrent(0);
  }, [game.id]);

  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % slides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [slides.length, paused]);

  const goPrev = () => setCurrent((c) => (c - 1 + slides.length) % slides.length);
  const goNext = () => setCurrent((c) => (c + 1) % slides.length);

  const onTouchStart = (e: ReactTouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
    swiped.current = false;
    setPaused(true);
  };
  const onTouchEnd = (e: ReactTouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    setPaused(false);
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      swiped.current = true;
      if (dx < 0) goNext();
      else goPrev();
    }
  };

  if (slides.length === 0 || !slides[0].image) {
    return (
      <div className="aspect-video rounded-xl bg-neutral-800 flex items-center justify-center text-neutral-500">
        Нет изображений
      </div>
    );
  }

  const metaBlock = (
    <>
      <h1 className="text-xl md:text-3xl font-bold text-white drop-shadow-lg line-clamp-2">
        {game.title}
      </h1>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {game.genres?.slice(0, 3).map((g) => (
          <span key={g.id} className="px-2 py-0.5 bg-white/20 backdrop-blur-sm text-white rounded text-[11px] font-medium">
            {g.name}
          </span>
        ))}
        <span className="px-2 py-0.5 bg-white/20 backdrop-blur-sm text-white rounded text-[11px] font-medium">
          {game.year}
        </span>
      </div>
    </>
  );

  const badges = (
    <>
      {game.metacritic && game.metacritic > 0 && (
        <div className={`${getMetacriticColor(game.metacritic)} px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-lg`}>
          <span className="text-xs font-bold">{game.metacritic}</span>
          <span className="text-[9px] opacity-70">MC</span>
        </div>
      )}
      {steamBadge}
    </>
  );

  return (
    <>
    <div
      className="relative aspect-video rounded-xl overflow-hidden bg-neutral-800 group/carousel select-none touch-pan-y"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => {
        touchStart.current = null;
        setPaused(false);
      }}
    >
      {slides.map((slide, idx) => (
        <div
          key={slide.id ?? `cover-${idx}`}
          className={`absolute inset-0 transition-opacity duration-500 ${
            idx === current ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'
          }`}
        >
          <img
            key={slide.image}
            src={slide.image}
            alt={game.title}
            className={`w-full h-full object-cover ${
              slide.type === 'screenshot' ? 'cursor-zoom-in' : ''
            }`}
            draggable={false}
            onClick={() => {
              if (swiped.current) {
                swiped.current = false;
                return;
              }
              if (slide.type === 'screenshot' && onScreenshotClick) {
                onScreenshotClick(slide.image);
              }
            }}
            loading={idx === 0 ? 'eager' : 'lazy'}
            onError={(e) => {
              // Если обложка недоступна, пробуем запасную картинку и арт IGDB.
              const el = e.currentTarget;
              if (slide.type !== 'cover') return;
              const chain = [...new Set([game.coverAlt, game.coverHD])]
                .filter((u): u is string => !!u && u !== slide.image);
              const step = Number(el.dataset.fallback || '0');
              if (step < chain.length) {
                el.dataset.fallback = String(step + 1);
                el.src = chain[step];
              }
            }}
          />
        </div>
      ))}

      {isDesktop && (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none z-20" />
          <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5">{badges}</div>
          <div className="absolute bottom-3 left-4 right-16 z-30 pointer-events-none">{metaBlock}</div>
        </>
      )}

      {slides.length > 1 && (
        <div className="absolute top-3 left-3 z-30 bg-black/50 backdrop-blur-sm text-white text-[11px] font-medium px-2 py-1 rounded-lg">
          {current + 1} / {slides.length}
        </div>
      )}

      {slides.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-30 w-9 h-9 bg-black/50 hover:bg-black/80 backdrop-blur-sm rounded-full flex items-center justify-center transition opacity-0 group-hover/carousel:opacity-100"
            aria-label="Назад"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-30 w-9 h-9 bg-black/50 hover:bg-black/80 backdrop-blur-sm rounded-full flex items-center justify-center transition opacity-0 group-hover/carousel:opacity-100"
            aria-label="Вперёд"
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
        </>
      )}

      {slides.length > 1 && (
        <div className="absolute bottom-3 right-3 z-30 flex gap-1">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setCurrent(idx);
              }}
              className={`h-1.5 rounded-full transition-all ${
                idx === current
                  ? 'w-5 bg-white'
                  : 'w-1.5 bg-white/50 hover:bg-white/80'
              }`}
              aria-label={`Слайд ${idx + 1}`}
            />
          ))}
        </div>
      )}

      {slides[current]?.type === 'screenshot' && (
        <div className="hidden md:block absolute top-14 right-3 z-30 bg-black/50 backdrop-blur-sm rounded-lg p-1.5 opacity-0 group-hover/carousel:opacity-100 transition">
          <Maximize2 className="w-3.5 h-3.5 text-white" />
        </div>
      )}
    </div>

    {!isDesktop && (
      <div className="mt-3">
        <h1 className="text-xl font-bold text-white line-clamp-2">{game.title}</h1>
        <div className="flex items-start justify-between gap-3 mt-2">
          <div className="flex flex-wrap gap-1.5 min-w-0">
            {game.genres?.slice(0, 3).map((g) => (
              <span key={g.id} className="px-2 py-0.5 bg-white/15 text-white rounded text-[11px] font-medium">
                {g.name}
              </span>
            ))}
            <span className="px-2 py-0.5 bg-white/15 text-white rounded text-[11px] font-medium">{game.year}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">{badges}</div>
        </div>
      </div>
    )}
    </>
  );
}
