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

function SteamIcon({ className, color = 'ffffff' }: { className?: string; color?: string }) {
  return (
    <img
      src={`https://cdn.simpleicons.org/steam/${color}`}
      alt="Steam"
      className={className}
      loading="lazy"
      width={16}
      height={16}
    />
  );
}

export default function SteamRating({ gameTitle, variant = 'inline' }: SteamRatingProps) {
  const [data, setData] = useState<SteamReviewData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!gameTitle) return;

    let cancelled = false;

    const load = async () => {
      // Мгновенно из кеша
      if (reviewCache.has(gameTitle)) {
        const cached = reviewCache.get(gameTitle);
        if (cached && !cancelled) setData(cached);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/steam/rating?name=${encodeURIComponent(gameTitle)}`);
        if (!res.ok) {
          reviewCache.set(gameTitle, null);
          return;
        }
        const revData = await res.json();

        if (cancelled) return;

        if (revData.percent !== null && revData.total > 0) {
          const result: SteamReviewData = {
            percent: revData.percent,
            total: revData.total,
            description: revData.description,
          };
          reviewCache.set(gameTitle, result);
          setData(result);
        } else {
          reviewCache.set(gameTitle, null);
        }
      } catch {
        // Ошибку не кешируем — попробуем при следующем запросе
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [gameTitle]);

  if (loading || !data) return null;

  if (variant === 'badge') {
    return (
      <div
        className="px-2 py-1 rounded-lg flex items-center gap-1 shadow-lg backdrop-blur-sm"
        style={{ backgroundColor: STEAM_BADGE_BG }}
        title={`${data.percent}% положительных отзывов в Steam`}
      >
        <SteamIcon className="w-3 h-3" color="ffffff" />
        <span className="text-xs font-bold text-white">{data.percent}%</span>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className="flex items-center gap-1 text-[10px] font-medium"
        style={{ color: STEAM_BLUE }}
        title={`${data.percent}% положительных отзывов в Steam`}
      >
        <SteamIcon className="w-3.5 h-3.5" color="66c0f4" />
        <span className="font-bold">{data.percent}%</span>
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border transition"
      style={{
        backgroundColor: STEAM_BG,
        borderColor: STEAM_BORDER,
      }}
      title={data.description || 'Рейтинг Steam'}
    >
      <SteamIcon className="w-4 h-4" color="66c0f4" />
      <span className="text-xs font-bold" style={{ color: STEAM_BLUE }}>
        {data.percent}%
      </span>
      <span className="text-[10px] text-neutral-400">
        {data.total.toLocaleString('ru-RU')} отзывов
      </span>
    </div>
  );
}