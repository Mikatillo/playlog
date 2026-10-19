'use client';

import { Clock, Star } from 'lucide-react';
import type { Aspects } from '@/lib/aspects';
import { getRatingColor, getSliderColor } from '@/lib/utils';
import AspectRatings from './AspectRatings';
import TimeToBeat from './TimeToBeat';

export default function GamePersonalFields({ gameId, playtime, rating, hours, aspects, onRating, onHours, onAspects }: {
  gameId: number; playtime?: number; rating: number; hours: number; aspects: Aspects;
  onRating: (value: number) => void; onHours: (value: number) => void; onAspects: (value: Aspects) => void;
}) {
  return <div className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
      <section className="min-w-0 rounded-2xl border border-neutral-700/50 bg-neutral-900/50 p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-200"><Star className="h-4 w-4 text-amber-300" />Твоя оценка</h3><span className={`text-lg font-bold tabular-nums ${getRatingColor(rating)}`}>{rating > 0 ? `${rating}/10` : '—'}</span></div>
        <input type="range" min="0" max="10" step="1" value={rating} onChange={(e) => onRating(Number(e.target.value))} aria-label="Твоя оценка от 0 до 10" className="h-2 w-full cursor-pointer appearance-none rounded-full" style={{ background: `linear-gradient(to right, ${getSliderColor(rating)} ${rating * 10}%, #404040 ${rating * 10}%)` }} />
        <div className="mt-2 flex justify-between text-[10px] text-neutral-600"><span>Без оценки</span><span>10 · Отлично</span></div>
      </section>
      <section className="min-w-0 rounded-2xl border border-neutral-700/50 bg-neutral-900/50 p-3 sm:p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-200"><Clock className="h-4 w-4 text-indigo-300" />Время в игре</h3>
        <div className="flex flex-wrap items-center gap-2"><input type="number" min="0" max="2147483647" step="1" aria-label="Часов наиграно" value={hours || ''} placeholder="0" onChange={(e) => onHours(Math.min(2147483647, Math.max(0, parseInt(e.target.value) || 0)))} className="w-24 rounded-lg border border-neutral-700 bg-neutral-950/50 px-3 py-1.5 text-sm text-white outline-none focus:border-indigo-400" /><span className="text-xs text-neutral-500">часов</span></div>
        <div className="mt-2"><TimeToBeat gameId={gameId} fallbackPlaytime={playtime} /></div>
      </section>
    </div>
    <AspectRatings key={gameId} value={aspects} overall={rating} onChange={onAspects} onSuggestOverall={onRating} />
  </div>;
}
