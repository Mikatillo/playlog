'use client';

import { Radar as RadarIcon, Sparkles } from 'lucide-react';
import { ASPECTS, summarizeTaste, type Aspects } from '@/lib/aspects';

export interface TasteEntry {
  title: string;
  aspects: Aspects;
}

interface TasteRadarProps {
  entries: TasteEntry[];
  isOwnProfile: boolean;
  /** Компактный вид внутри другого блока (без рамки и крупного заголовка) */
  embedded?: boolean;
}

const CX = 140;
const CY = 118;
const R = 74;

// Порядок осей: сверху по часовой — геймплей, сюжет, графика, музыка
const DIRS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

const point = (i: number, value: number) => {
  const d = DIRS[i];
  const r = (R * value) / 10;
  return { x: CX + d.x * r, y: CY + d.y * r };
};

export default function TasteRadar({ entries, isOwnProfile, embedded = false }: TasteRadarProps) {
  const summary = summarizeTaste(entries.map((e) => e.aspects));

  if (summary.gamesCount === 0) {
    if (!isOwnProfile) return null;
    if (embedded) {
      return (
        <p className="text-sm text-neutral-500">
          Оцени игры по геймплею, сюжету, графике и музыке (в карточке игры), и здесь появится радар вкуса.
        </p>
      );
    }
    return (
      <section className="bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-2xl p-5 flex items-center gap-4">
        <span className="w-11 h-11 rounded-xl bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
          <RadarIcon className="w-5 h-5 text-indigo-400" />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold text-white">Радар вкуса</h3>
          <p className="text-sm text-neutral-400 mt-0.5">
            Открой любую игру в коллекции и поставь оценки по геймплею, сюжету, графике и музыке — здесь
            появится твой вкусовой портрет.
          </p>
        </div>
      </section>
    );
  }

  const values = ASPECTS.map((m) => summary.averages[m.key]);
  const polygon = values.map((v, i) => point(i, v)).map((p) => `${p.x},${p.y}`).join(' ');
  const ring = (level: number) =>
    DIRS.map((_, i) => point(i, level)).map((p) => `${p.x},${p.y}`).join(' ');

  // Лучшая игра по каждому аспекту
  const best = ASPECTS.map((m) => {
    let top: { title: string; v: number } | null = null;
    entries.forEach((e) => {
      const v = e.aspects[m.key];
      if (v > 0 && (!top || v > top.v)) top = { title: e.title, v };
    });
    return top as { title: string; v: number } | null;
  });

  const Wrapper = embedded ? 'div' : 'section';

  return (
    <Wrapper className={embedded ? '' : 'bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-2xl p-5'}>
      <div className={`flex items-center justify-between gap-3 ${embedded ? 'mb-2' : 'mb-4'}`}>
        {embedded ? (
          <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Радар вкуса</div>
        ) : (
          <h3 className="font-semibold text-white flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center">
              <RadarIcon className="w-4 h-4 text-indigo-400" />
            </span>
            Радар вкуса
          </h3>
        )}
        <span className="text-xs text-neutral-500">по {summary.gamesCount} {pluralGames(summary.gamesCount)}</span>
      </div>

      <div className={embedded ? 'flex flex-col gap-4' : 'grid md:grid-cols-[300px_1fr] gap-5 md:gap-8 items-center'}>
        {/* Радар */}
        <div className={`mx-auto w-full ${embedded ? 'max-w-[220px]' : 'max-w-[300px]'}`}>
          <svg viewBox="0 0 280 236" className="w-full h-auto" role="img" aria-label="Радар вкуса">
            <defs>
              <linearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#d946ef" stopOpacity="0.4" />
              </linearGradient>
            </defs>

            {[2.5, 5, 7.5, 10].map((lvl) => (
              <polygon key={lvl} points={ring(lvl)} fill="none" stroke="#2f2f2f" strokeWidth="1" />
            ))}
            {DIRS.map((d, i) => (
              <line key={i} x1={CX} y1={CY} x2={CX + d.x * R} y2={CY + d.y * R} stroke="#2f2f2f" strokeWidth="1" />
            ))}

            <g className="radar-in" style={{ transformOrigin: `${CX}px ${CY}px` }}>
              <polygon points={polygon} fill="url(#radarFill)" stroke="#a5b4fc" strokeWidth="2" strokeLinejoin="round" />
              {values.map((v, i) => {
                const p = point(i, v);
                return <circle key={i} cx={p.x} cy={p.y} r="4.5" fill={ASPECTS[i].color} stroke="#0a0a0a" strokeWidth="2" />;
              })}
            </g>

            {/* Подписи осей */}
            <AxisLabel x={CX} y={14} anchor="middle" i={0} value={values[0]} />
            <AxisLabel x={CX + R + 12} y={CY - 2} anchor="start" i={1} value={values[1]} />
            <AxisLabel x={CX} y={CY + R + 26} anchor="middle" i={2} value={values[2]} />
            <AxisLabel x={CX - R - 12} y={CY - 2} anchor="end" i={3} value={values[3]} />
          </svg>
        </div>

        {/* Расшифровка */}
        <div className="min-w-0 space-y-4">
          {summary.archetype && (
            <div className="rounded-xl bg-gradient-to-r from-indigo-500/15 to-fuchsia-500/10 border border-indigo-500/25 p-3.5 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm text-neutral-400 leading-none">Тип игрока</div>
                <div className="text-lg font-extrabold text-white mt-1">{summary.archetype.title}</div>
                <div className="text-xs text-neutral-400 mt-0.5">{summary.archetype.hint}</div>
              </div>
            </div>
          )}

          <ul className="space-y-3">
            {ASPECTS.map((m, i) => {
              const avg = summary.averages[m.key];
              const b = best[i];
              return (
                <li key={m.key}>
                  <div className="flex items-center justify-between text-sm mb-1 gap-2">
                    <span className="text-neutral-200 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: m.color }} />
                      {m.label}
                    </span>
                    <span className="font-bold text-white tabular-nums">{avg > 0 ? avg.toFixed(1) : '—'}</span>
                  </div>
                  <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${avg * 10}%`, background: m.color }}
                    />
                  </div>
                  {b && !embedded && (
                    <div className="text-[11px] text-neutral-500 mt-1 truncate">
                      Лучше всего: <span className="text-neutral-300">{b.title}</span> · {b.v}/10
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Wrapper>
  );
}

function AxisLabel({
  x, y, anchor, i, value,
}: {
  x: number; y: number; anchor: 'start' | 'middle' | 'end'; i: number; value: number;
}) {
  const m = ASPECTS[i];
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize="12" fontWeight="600" fill="#d4d4d4">
      {m.label}
      <tspan x={x} dy="14" fontSize="11" fill={m.color}>
        {value > 0 ? value.toFixed(1) : '—'}
      </tspan>
    </text>
  );
}

function pluralGames(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'игре';
  return 'играм';
}
