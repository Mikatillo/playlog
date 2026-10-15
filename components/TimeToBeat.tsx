'use client';

import { useEffect, useState } from 'react';

interface TimeToBeatProps {
  gameId: number;
  /** Запасное значение «среднее время», если по игре нет данных о прохождении */
  fallbackPlaytime?: number;
}

type Data = { story: number | null; full: number | null };

const cache = new Map<number, Data>();

const pill =
  'text-[11px] text-neutral-300 bg-neutral-900/50 px-2 py-1 rounded-md border border-neutral-700 whitespace-nowrap';

/** Сколько часов нужно на сюжет и на полное прохождение (данные игроков с IGDB). */
export default function TimeToBeat({ gameId, fallbackPlaytime }: TimeToBeatProps) {
  const [data, setData] = useState<Data | null>(cache.get(gameId) ?? null);

  useEffect(() => {
    const hit = cache.get(gameId);
    if (hit) {
      setData(hit);
      return;
    }
    setData(null);
    let cancelled = false;
    fetch(`/api/games/${gameId}/time-to-beat`)
      .then((r) => r.json())
      .then((d) => {
        const v: Data = { story: d.story ?? null, full: d.full ?? null };
        cache.set(gameId, v);
        if (!cancelled) setData(v);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  if (data && (data.story || data.full)) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {data.story && <span className={pill} title="Время на прохождение сюжета">📖 Сюжет ~{data.story} ч</span>}
        {data.full && <span className={pill} title="Время на полное прохождение (100%)">🏆 100% ~{data.full} ч</span>}
      </div>
    );
  }

  if (fallbackPlaytime) {
    return <span className={pill}>⏱ ~{fallbackPlaytime} ч. среднее</span>;
  }
  return null;
}
