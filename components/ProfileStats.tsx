'use client';

import { useId, useState } from 'react';
import TasteRadar, { type TasteEntry } from '@/components/TasteRadar';
import {
  BarChart3, Clock, Star, Trophy, Gamepad2, Flame, ChevronDown, Hourglass,
} from 'lucide-react';

interface ProfileStatsProps {
  topGenres: [string, number][];
  statusCounts: { playing: number; completed: number; dropped: number; want: number };
  totalHours: number;
  averageRating: number | null;
  totalGames: number;
  /** Оценки по аспектам для радара вкуса */
  tasteEntries?: TasteEntry[];
  isOwnProfile?: boolean;
}

const STATUS_SEGMENTS = [
  { key: 'completed', label: 'Пройдено', color: '#10b981' },
  { key: 'playing', label: 'Играю', color: '#6366f1' },
  { key: 'dropped', label: 'Заброшено', color: '#f43f5e' },
] as const;

const GENRE_GRADIENTS = [
  'from-indigo-500 to-violet-400',
  'from-sky-500 to-cyan-300',
  'from-emerald-500 to-lime-300',
  'from-amber-500 to-yellow-300',
  'from-rose-500 to-pink-300',
];

function Donut({ values, total }: { values: { value: number; color: string }[]; total: number }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const sum = values.reduce((s, v) => s + v.value, 0);
  const visible = values.filter((x) => x.value > 0).length;
  let offset = 0;

  return (
    <div className="relative w-32 h-32 flex-shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#262626" strokeWidth="11" />
        {sum > 0 &&
          values.map((v, i) => {
            if (v.value === 0) return null;
            const len = (v.value / sum) * c;
            const gap = visible > 1 ? 2 : 0;
            const dash = Math.max(len - gap, 0);
            const el = (
              <circle
                key={i}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={v.color}
                strokeWidth="11"
                strokeLinecap="butt"
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                className="transition-all duration-700"
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold text-white leading-none">{total}</span>
        <span className="text-[10px] text-neutral-500 mt-1 uppercase tracking-wider">игр</span>
      </div>
    </div>
  );
}

export default function ProfileStats({
  topGenres,
  statusCounts,
  totalHours,
  averageRating,
  totalGames,
  tasteEntries = [],
  isOwnProfile = false,
}: ProfileStatsProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const panelId = useId();

  const tracked = statusCounts.completed + statusCounts.playing + statusCounts.dropped;
  const completionRate = tracked > 0 ? Math.round((statusCounts.completed / tracked) * 100) : 0;
  const maxGenre = topGenres[0]?.[1] || 1;
  const hoursPerGame = totalGames > 0 ? Math.round(totalHours / totalGames) : 0;

  const tiles = [
    { icon: Clock, label: 'Часов в играх', value: totalHours.toLocaleString('ru-RU'), tint: 'text-sky-400 bg-sky-500/10' },
    { icon: Star, label: 'Средняя оценка', value: averageRating !== null ? averageRating.toFixed(1) : '—', tint: 'text-amber-400 bg-amber-500/10' },
    { icon: Trophy, label: 'Прошёл из начатых', value: `${completionRate}%`, tint: 'text-emerald-400 bg-emerald-500/10' },
    { icon: Gamepad2, label: 'В желаемом', value: String(statusCounts.want), tint: 'text-fuchsia-400 bg-fuchsia-500/10' },
    { icon: Hourglass, label: 'Часов на игру', value: hoursPerGame.toLocaleString('ru-RU'), tint: 'text-orange-400 bg-orange-500/10' },
    { icon: Flame, label: 'Любимый жанр', value: topGenres[0]?.[0] ?? '—', tint: 'text-rose-400 bg-rose-500/10' },
  ];

  return (
    <div className="bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-2xl p-5 flex flex-col gap-5 lg:min-h-[480px]">
      <h3 className="font-semibold text-white flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center">
          <BarChart3 className="w-4 h-4 text-indigo-400" />
        </span>
        <span className="lg:hidden">Статистика</span>
        <span className="hidden lg:inline">Статистика профиля</span>
      </h3>
      <div className="contents">

      {/* Статистика профиля: всегда на виду */}
      <div className="grid grid-cols-2 gap-2.5 lg:flex-1 lg:auto-rows-fr">
        {tiles.map(({ icon: Icon, label, value, tint }) => (
          <div
            key={label}
            className="rounded-xl bg-neutral-800/60 border border-neutral-800 p-3 transition hover:border-neutral-700 hover:bg-neutral-800 flex flex-col items-start justify-center"
          >
            <span className={`w-7 h-7 rounded-lg inline-flex items-center justify-center ${tint}`}>
              <Icon className="w-3.5 h-3.5" />
            </span>
            <div className="text-xl font-bold text-white mt-2 leading-none truncate" title={value}>{value}</div>
            <div className="text-[11px] text-neutral-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Интересы и статусы: свёрнуты по умолчанию, раскрываются по клику */}
      <div className="border-t border-neutral-800 pt-4 -mb-1">
        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          aria-expanded={detailsOpen}
          aria-controls={panelId}
          className="group w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 bg-neutral-800/40 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 transition"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-neutral-200">
            <Flame className="w-4 h-4 text-amber-400" />
            Интересы
          </span>
          <span className="flex items-center gap-2 text-xs text-neutral-500 group-hover:text-neutral-300 transition">
            {detailsOpen ? 'Свернуть' : 'Показать'}
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-300 ${detailsOpen ? 'rotate-180' : ''}`}
            />
          </span>
        </button>

        {/* Плавное раскрытие: высота анимируется через grid-template-rows */}
        <div
          id={panelId}
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
            detailsOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
          aria-hidden={!detailsOpen}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-5 pt-4">
              {/* Статусы игр: кольцевая диаграмма + легенда */}
              <div>
                <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">Статусы игр</div>
                <div className="flex items-center gap-5">
                  <Donut
                    total={totalGames}
                    values={STATUS_SEGMENTS.map((s) => ({ value: statusCounts[s.key], color: s.color }))}
                  />
                  <ul className="flex-1 space-y-2.5 min-w-0">
                    {STATUS_SEGMENTS.map((s) => {
                      const count = statusCounts[s.key];
                      const percent = tracked > 0 ? Math.round((count / tracked) * 100) : 0;
                      return (
                        <li key={s.key} className="flex items-center gap-2 text-sm">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                          <span className="text-neutral-300 truncate">{s.label}</span>
                          <span className="ml-auto text-white font-semibold">{count}</span>
                          <span className="text-neutral-500 text-xs w-9 text-right">{percent}%</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>

              {/* Радар вкуса: средние оценки по аспектам */}
              <TasteRadar embedded entries={tasteEntries} isOwnProfile={isOwnProfile} />

              {/* Любимые жанры */}
              <div>
                <div className="flex items-center justify-between mb-3 gap-2">
                  <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Любимые жанры</div>
                  {topGenres[0] && (
                    <span className="flex items-center gap-1 text-[11px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full max-w-[60%]">
                      <Flame className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{topGenres[0][0]}</span>
                    </span>
                  )}
                </div>
                {topGenres.length === 0 ? (
                  <p className="text-sm text-neutral-500">Добавь игры в коллекцию, и здесь появятся жанры</p>
                ) : (
                  <ul className="space-y-2.5">
                    {topGenres.map(([genre, count], i) => (
                      <li key={genre}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-neutral-300 truncate pr-2">{genre}</span>
                          <span className="text-neutral-500 flex-shrink-0">{count}</span>
                        </div>
                        <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${GENRE_GRADIENTS[i % GENRE_GRADIENTS.length]} transition-all duration-700`}
                            style={{ width: `${Math.max((count / maxGenre) * 100, 6)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
