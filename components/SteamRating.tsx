'use client';

import { useEffect, useState } from 'react';

type SteamVariant = 'badge' | 'inline' | 'compact';

interface SteamRatingProps {
  gameTitle: string;
  variant?: SteamVariant;
}

interface SteamReviewData {
  percent: number;
  total: number;
  description: string;
}

// Глобальный кеш в памяти браузера
const reviewCache = new Map<string, SteamReviewData | null>();

const STEAM_BLUE = '#66c0f4';
const STEAM_BG = 'rgba(102, 192, 244, 0.1)';
const STEAM_BORDER = 'rgba(102, 192, 244, 0.3)';
const STEAM_BADGE_BG = 'rgba(27, 108, 168, 0.85)';

// Встроенная SVG иконка Steam — работает без внешних запросов!
function SteamIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.48 24 11.979 24c6.627 0 12-5.373 12-12S18.605 0 11.979 0zM7.53 18.243l-1.473-.61c.392.896 1.278 1.532 2.318 1.532 1.345 0 2.438-1.088 2.438-2.431 0-.313-.064-.611-.164-.884l1.549-.65c.26.441.412.951.412 1.496 0 1.875-1.521 3.396-3.396 3.396-.69 0-1.341-.202-1.884-.551zm8.414-7.764c-1.66 0-3.011 1.345-3.011 3.011 0 1.665 1.351 3.01 3.011 3.01 1.665 0 3.01-1.345 3.01-3.01 0-1.666-1.345-3.011-3.01-3.011zm0 5.162c-1.185 0-2.149-.965-2.149-2.149 0-1.184.964-2.152 2.149-2.152 1.182 0 2.148.968 2.148 2.152 0 1.184-.966 2.149-2.148 2.149z" />
    </svg>
  );
}

// Очередь запросов: не больше 3 одновременно, чтобы десятки карточек
// не забивали соединения браузера и не тормозили остальные запросы страницы.
const MAX_PARALLEL = 3;
let running = 0;
const queue: (() => void)[] = [];
const inflight = new Map<string, Promise<SteamReviewData | null>>();

function runLimited<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      running++;
      task()
        .then(resolve, reject)
        .finally(() => {
          running--;
          queue.shift()?.();
        });
    };
    if (running < MAX_PARALLEL) start();
    else queue.push(start);
  });
}

function loadRating(gameTitle: string): Promise<SteamReviewData | null> {
  if (reviewCache.has(gameTitle)) return Promise.resolve(reviewCache.get(gameTitle) ?? null);
  const existing = inflight.get(gameTitle);
  if (existing) return existing;

  const promise = runLimited(async () => {
    try {
      const res = await fetch(`/api/steam/rating?name=${encodeURIComponent(gameTitle)}`);
      if (!res.ok) return null;
      const revData = await res.json();
      if (revData.percent !== null && revData.percent !== undefined && revData.total > 0) {
        return {
          percent: revData.percent,
          total: revData.total,
          description: revData.description,
        } as SteamReviewData;
      }
      return null;
    } catch {
      return null;
    }
  }).then((result) => {
    reviewCache.set(gameTitle, result);
    inflight.delete(gameTitle);
    return result;
  });

  inflight.set(gameTitle, promise);
  return promise;
}

export default function SteamRating({ gameTitle, variant = 'inline' }: SteamRatingProps) {
  const [data, setData] = useState<SteamReviewData | null>(
    () => reviewCache.get(gameTitle) ?? null,
  );
  const [loading, setLoading] = useState(() => !reviewCache.has(gameTitle));
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  // Загружаем рейтинг только когда карточка появилась на экране
  useEffect(() => {
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);

  useEffect(() => {
    if (!gameTitle || !visible) return;
    let cancelled = false;
    loadRating(gameTitle).then((result) => {
      if (cancelled) return;
      setData(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [gameTitle, visible]);

  // ===== ИКОНКА STEAM ПОКАЗЫВАЕТСЯ ВСЕГДА =====

  if (variant === 'badge') {
    return (
      <div
        ref={setEl}
        className="px-2 py-1 rounded-lg flex items-center gap-1 shadow-lg backdrop-blur-sm"
        style={{ backgroundColor: STEAM_BADGE_BG }}
        title={data ? `${data.percent}% положительных отзывов в Steam` : 'Steam'}
      >
        <SteamIcon className="w-3 h-3 text-white" />
        {!loading && data ? (
          <span className="text-xs font-bold text-white">{data.percent}%</span>
        ) : loading ? (
          <span className="text-xs text-white/50">...</span>
        ) : null}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        ref={setEl}
        className="flex items-center gap-1 text-[10px] font-medium"
        style={{ color: STEAM_BLUE }}
        title={data ? `${data.percent}% положительных отзывов в Steam` : 'Steam'}
      >
        <SteamIcon className="w-3.5 h-3.5" style={{ color: STEAM_BLUE }} />
        {!loading && data ? (
          <span className="font-bold">{data.percent}%</span>
        ) : loading ? (
          <span className="opacity-50">...</span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={setEl}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border transition"
      style={{
        backgroundColor: STEAM_BG,
        borderColor: STEAM_BORDER,
      }}
      title={data?.description || 'Рейтинг Steam'}
    >
      <SteamIcon className="w-4 h-4" style={{ color: STEAM_BLUE }} />
      {!loading && data ? (
        <>
          <span className="text-xs font-bold" style={{ color: STEAM_BLUE }}>
            {data.percent}%
          </span>
          <span className="text-[10px] text-neutral-400">
            {data.total.toLocaleString('ru-RU')} отзывов
          </span>
        </>
      ) : loading ? (
        <span className="text-xs opacity-50">Загрузка...</span>
      ) : (
        <span className="text-xs opacity-50">Steam</span>
      )}
    </div>
  );
}