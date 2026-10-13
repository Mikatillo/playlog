'use client';

import { useId, useState } from 'react';
import { ChevronDown, Radar } from 'lucide-react';
import { ASPECTS, aspectsAverage, hasAspects, type AspectKey, type Aspects } from '@/lib/aspects';

interface AspectRatingsProps {
  value: Aspects;
  /** текущая общая оценка (0 = не поставлена) */
  overall: number;
  onChange: (next: Aspects) => void;
  /** подсказка: общая оценка пересчитана как среднее аспектов */
  onSuggestOverall: (rating: number) => void;
}

export default function AspectRatings({ value, overall, onChange, onSuggestOverall }: AspectRatingsProps) {
  const [open, setOpen] = useState(hasAspects(value));
  const panelId = useId();
  const filled = hasAspects(value);

  const update = (key: AspectKey, v: number) => {
    const prevAvg = Math.round(aspectsAverage(value));
    const next = { ...value, [key]: v };
    onChange(next);
    // Общую оценку подставляем сами, пока она пустая или совпадает с прошлым средним
    const newAvg = Math.round(aspectsAverage(next));
    if (newAvg > 0 && (overall === 0 || overall === prevAvg)) onSuggestOverall(newAvg);
  };

  return (
    <div className="bg-neutral-800 rounded-xl p-4 md:p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Radar className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          <span className="font-semibold text-white text-sm md:text-base">Оценка по аспектам</span>
          <span className="hidden sm:inline text-[11px] text-neutral-500 truncate">
            {filled ? 'для радара вкуса в профиле' : 'необязательно'}
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Краткая сводка, когда блок свёрнут */}
      {!open && filled && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ASPECTS.filter((m) => value[m.key] > 0).map((m) => (
            <span
              key={m.key}
              className="text-[11px] px-2 py-0.5 rounded-md bg-neutral-900/70 border border-neutral-700 text-neutral-300"
            >
              <span style={{ color: m.color }}>●</span> {m.label} <b className="text-white">{value[m.key]}</b>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div id={panelId} className="mt-4 space-y-4">
          {ASPECTS.map((m) => {
            const v = value[m.key];
            return (
              <div key={m.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.color }} />
                      {m.label}
                    </div>
                    <div className="text-[11px] text-neutral-500 truncate">{m.hint}</div>
                  </div>
                  <span className="text-base font-bold tabular-nums" style={{ color: v > 0 ? m.color : '#737373' }}>
                    {v > 0 ? `${v}/10` : '—'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={v}
                  onChange={(e) => update(m.key, parseInt(e.target.value))}
                  aria-label={`${m.label}: оценка от 0 до 10`}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, ${m.color} 0%, ${m.color} ${v * 10}%, #404040 ${v * 10}%, #404040 100%)`,
                  }}
                />
              </div>
            );
          })}
          <div className="flex items-center justify-between pt-1">
            <p className="text-[11px] text-neutral-500">0 — не оценивать этот аспект</p>
            {filled && (
              <button
                type="button"
                onClick={() => onChange({ gameplay: 0, story: 0, visuals: 0, music: 0 })}
                className="text-[11px] text-neutral-400 hover:text-white underline underline-offset-2"
              >
                Сбросить
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
