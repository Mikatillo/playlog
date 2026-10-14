'use client';

import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface ScreenshotViewerProps {
  images: string[];
  /** Открытый сейчас скриншот */
  current: string;
  onChange: (url: string) => void;
  onClose: () => void;
}

/** Полноэкранный просмотр скриншотов: свайп пальцем, стрелки на экране и клавиатуре. */
export default function ScreenshotViewer({ images, current, onChange, onClose }: ScreenshotViewerProps) {
  const list = images.includes(current) ? images : [current, ...images];
  const index = Math.max(0, list.indexOf(current));
  const touch = useRef<{ x: number; y: number } | null>(null);

  const go = (dir: 1 | -1) => {
    if (list.length < 2) return;
    onChange(list[(index + dir + list.length) % list.length]);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Соседние кадры подгружаем заранее, чтобы листалось без задержки
  useEffect(() => {
    [list[(index + 1) % list.length], list[(index - 1 + list.length) % list.length]].forEach((src) => {
      if (src) new Image().src = src;
    });
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="fixed inset-0 bg-black/95 z-[10000] flex items-center justify-center touch-pan-y"
      onClick={onClose}
      onTouchStart={(e) => {
        const t = e.touches[0];
        touch.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const start = touch.current;
        touch.current = null;
        if (!start) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) go(dx < 0 ? 1 : -1);
        else if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5) onClose(); // свайп вниз закрывает
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Закрыть"
        className="absolute top-[calc(1rem+env(safe-area-inset-top))] right-4 w-12 h-12 bg-neutral-800/90 hover:bg-neutral-700 rounded-full flex items-center justify-center transition z-10"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {list.length > 1 && (
        <div className="absolute top-[calc(1.5rem+env(safe-area-inset-top))] left-4 z-10 bg-black/60 text-white text-xs font-medium px-2.5 py-1 rounded-lg">
          {index + 1} / {list.length}
        </div>
      )}

      {list.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            aria-label="Предыдущий скриншот"
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-neutral-800/90 hover:bg-neutral-700 rounded-full items-center justify-center transition"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            aria-label="Следующий скриншот"
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-neutral-800/90 hover:bg-neutral-700 rounded-full items-center justify-center transition"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        </>
      )}

      <img
        key={current}
        src={current}
        alt="Скриншот"
        draggable={false}
        className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl select-none"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
