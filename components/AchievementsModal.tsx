'use client';

import { useState, useEffect } from 'react';
import { X, Trophy, Lock, Check, Sparkles } from 'lucide-react';
import { getAchievementLevel } from '@/types/game';
import { ACHIEVEMENTS, type AchievementDef, type AchievementStats } from '@/lib/achievements';
import { TIERS, tierForLevel } from '@/lib/achievement-art';
import AchievementBadge from './AchievementBadge';

interface AchievementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: AchievementStats;
}

const MAX_LEVEL = 10;

export default function AchievementsModal({ isOpen, onClose, stats }: AchievementsModalProps) {
  const [selected, setSelected] = useState<AchievementDef | null>(null);

  // Escape закрывает сначала детали, потом саму модалку
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selected) setSelected(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, selected, onClose]);

  // Блокируем прокрутку страницы под модалкой
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const rows = ACHIEVEMENTS.map((a) => {
    const value = a.getValue(stats);
    return { def: a, value, ...getAchievementLevel(a.thresholds, value) };
  });
  const totalLevels = rows.reduce((sum, r) => sum + r.level, 0);
  const maxLevels = ACHIEVEMENTS.length * MAX_LEVEL;
  const totalProgress = Math.round((totalLevels / maxLevels) * 100);
  const unlocked = rows.filter((r) => r.level > 0).length;

  const selectedRow = selected ? rows.find((r) => r.def.id === selected.id)! : null;

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[10000] flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 sm:rounded-3xl rounded-t-3xl w-full max-w-4xl max-h-[92vh] overflow-y-auto relative shadow-2xl border border-neutral-800 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Закрыть"
          className="sticky top-3 float-right mr-3 mt-3 w-10 h-10 bg-neutral-800/90 hover:bg-neutral-700 rounded-full flex items-center justify-center transition z-20 hover:rotate-90"
        >
          <X className="w-5 h-5 text-neutral-300" />
        </button>

        <div className="p-5 sm:p-8">
          {/* Заголовок и общий прогресс */}
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-neutral-900 to-indigo-500/10 p-5 sm:p-6 mb-6">
            <div className="absolute -top-16 -right-10 w-48 h-48 bg-amber-400/10 blur-3xl rounded-full pointer-events-none" />
            <div className="relative flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-300 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 flex-shrink-0">
                <Trophy className="w-7 h-7 text-amber-950" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-white">Достижения</h1>
                <p className="text-sm text-neutral-400">
                  Открыто {unlocked} из {ACHIEVEMENTS.length} · {totalLevels} из {maxLevels} уровней
                </p>
              </div>
              <div className="ml-auto text-right hidden sm:block">
                <div className="text-3xl font-extrabold text-amber-300 leading-none">{totalProgress}%</div>
                <div className="text-[11px] text-neutral-500 mt-1">общий прогресс</div>
              </div>
            </div>
            <div className="relative mt-4 h-2.5 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-400 transition-all duration-700"
                style={{ width: `${totalProgress}%` }}
              />
            </div>
          </div>

          {/* Сетка достижений */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {rows.map(({ def, value, level, progress, nextThreshold }) => {
              const tier = tierForLevel(level);
              const isMax = level === MAX_LEVEL;
              return (
                <button
                  key={def.id}
                  onClick={() => setSelected(def)}
                  className="group relative text-left rounded-2xl border border-neutral-800 bg-neutral-800/40 p-4 pt-5 transition-all duration-200 hover:-translate-y-1 hover:border-neutral-600 hover:bg-neutral-800/70 active:scale-[0.98] overflow-hidden"
                  style={{ boxShadow: tier ? `0 10px 30px -12px ${tier.glow}` : undefined }}
                >
                  {tier && (
                    <div
                      className="absolute inset-x-0 -top-10 h-24 opacity-40 blur-2xl pointer-events-none transition-opacity group-hover:opacity-70"
                      style={{ background: tier.glow }}
                    />
                  )}
                  <div className="relative flex justify-center mb-3 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                    <AchievementBadge id={def.id} level={level} size={92} />
                  </div>
                  <div className="relative text-center">
                    <div className="font-semibold text-sm text-white">{def.title}</div>
                    <div className="text-[11px] mt-0.5 font-medium" style={{ color: tier ? tier.mid : '#737373' }}>
                      {tier ? `${tier.name} · ур. ${level}` : 'Не открыто'}
                    </div>
                  </div>
                  <div className="relative mt-3 h-1.5 bg-neutral-700/70 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${progress}%`, background: tier ? `linear-gradient(90deg, ${tier.dark}, ${tier.light})` : '#525252' }}
                    />
                  </div>
                  <div className="relative text-[10px] text-neutral-500 mt-1.5 text-center">
                    {isMax ? `${value} · максимум` : `${value} / ${nextThreshold}`}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Ранги */}
          <div className="mt-8 pt-6 border-t border-neutral-800">
            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Ранги значков
            </h3>
            <div className="flex flex-wrap gap-2">
              {TIERS.map((t, i) => (
                <div
                  key={t.key}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-neutral-800 bg-neutral-800/50"
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full"
                    style={{ background: `linear-gradient(135deg, ${t.light}, ${t.dark})`, boxShadow: `0 0 8px ${t.glow}` }}
                  />
                  <span className="text-xs text-neutral-300">{t.name}</span>
                  <span className="text-[10px] text-neutral-500">ур. {i * 2 + 1}–{i * 2 + 2}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Детали достижения */}
      {selectedRow && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10001] flex items-end sm:items-center justify-center sm:p-4"
          onClick={(e) => {
            e.stopPropagation();
            setSelected(null);
          }}
        >
          <div
            className="bg-neutral-900 sm:rounded-3xl rounded-t-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 relative border border-neutral-800 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              aria-label="Закрыть"
              className="absolute top-4 right-4 w-8 h-8 bg-neutral-800 hover:bg-neutral-700 rounded-full flex items-center justify-center transition"
            >
              <X className="w-4 h-4 text-neutral-400" />
            </button>

            {(() => {
              const { def, value, level, progress, nextThreshold } = selectedRow;
              const tier = tierForLevel(level);
              const isMax = level === MAX_LEVEL;
              return (
                <>
                  <div className="flex flex-col items-center text-center mb-5">
                    <div className="relative">
                      {tier && (
                        <div className="absolute inset-0 blur-2xl opacity-60 rounded-full" style={{ background: tier.glow }} />
                      )}
                      <AchievementBadge id={def.id} level={level} size={132} className="relative" />
                    </div>
                    <h2 className="text-xl font-bold text-white mt-3">{def.title}</h2>
                    <p className="text-sm text-neutral-400 mt-1 max-w-xs">{def.description}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                        style={{ background: (tier ? tier.mid : '#737373') + '25', color: tier ? tier.light : '#a3a3a3' }}
                      >
                        {tier ? `${tier.name} · уровень ${level}` : 'Не открыто'}
                      </span>
                      {isMax && (
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300">
                          МАКСИМУМ
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-neutral-800/70 rounded-2xl p-4 mb-5">
                    <div className="flex items-center justify-between mb-2 text-sm">
                      <span className="text-neutral-400">Прогресс</span>
                      <span className="font-bold text-white">
                        {value} {isMax ? '(максимум)' : `/ ${nextThreshold}`}
                      </span>
                    </div>
                    <div className="h-2.5 bg-neutral-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${progress}%`, background: tier ? `linear-gradient(90deg, ${tier.dark}, ${tier.light})` : '#525252' }}
                      />
                    </div>
                    {!isMax && (
                      <div className="text-xs text-neutral-500 mt-1.5">{Math.round(progress)}% до следующего уровня</div>
                    )}
                  </div>

                  <h3 className="text-sm font-medium text-white mb-2">Все уровни</h3>
                  <div className="space-y-1.5">
                    {def.thresholds.map((threshold, idx) => {
                      const lvl = idx + 1;
                      const lvlTier = tierForLevel(lvl)!;
                      const done = value >= threshold;
                      const current = lvl === level;
                      return (
                        <div
                          key={lvl}
                          className={`flex items-center gap-3 p-2 rounded-xl transition ${
                            current ? 'bg-neutral-800 ring-1 ring-neutral-700' : ''
                          }`}
                        >
                          <AchievementBadge id={def.id} level={done ? lvl : 0} size={36} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-white">
                              Уровень {lvl} · {lvlTier.name}
                            </div>
                            <div className="text-[11px] text-neutral-500">
                              {threshold} {def.unit}
                            </div>
                          </div>
                          {done ? (
                            <Check className="w-4 h-4 flex-shrink-0" style={{ color: lvlTier.mid }} />
                          ) : (
                            <Lock className="w-4 h-4 flex-shrink-0 text-neutral-600" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
