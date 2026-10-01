'use client';

import { useState, useEffect } from 'react';
import {
  X, Gamepad, Check, Trophy, Star, Clock,
  Flame, Crown, Lock, TrendingUp, BookOpen,
} from 'lucide-react';
import { ACHIEVEMENT_LEVELS, getAchievementLevel } from '@/types/game';

interface AchievementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: {
    total: number;
    completed: number;
    playing: number;
    want: number;
    dropped: number;
    totalHours: number;
    ratedGames: number;
    reviewsCount: number;
  };
}

const iconMap: Record<string, any> = {
  Check,
  Gamepad,
  Trophy,
  Star,
  Clock,
  Flame,
  Crown,
  TrendingUp,
  BookOpen,
};

interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  getValue: (stats: any) => number;
  thresholds: number[];
}

const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'collector',
    title: 'Коллекционер',
    description: 'Добавь игры в свой список',
    icon: 'Crown',
    getValue: (s) => s.total,
    thresholds: [1, 5, 10, 25, 50, 100, 200, 500, 1000, 2500],
  },
  {
    id: 'finisher',
    title: 'Финишёр',
    description: 'Пройди игры до конца',
    icon: 'Check',
    getValue: (s) => s.completed,
    thresholds: [1, 3, 5, 10, 20, 50, 100, 200, 500, 1000],
  },
  {
    id: 'hardcore',
    title: 'Хардкорщик',
    description: 'Наиграй часы в играх',
    icon: 'Flame',
    getValue: (s) => s.totalHours,
    thresholds: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000],
  },
  {
    id: 'critic',
    title: 'Критик',
    description: 'Оцени игры',
    icon: 'Star',
    getValue: (s) => s.ratedGames,
    thresholds: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500],
  },
  {
    id: 'writer',
    title: 'Писатель',
    description: 'Напиши рецензии',
    icon: 'BookOpen',
    getValue: (s) => s.reviewsCount,
    thresholds: [1, 3, 5, 10, 25, 50, 100, 250, 500, 1000],
  },
  {
    id: 'explorer',
    title: 'Исследователь',
    description: 'Добавь игры в "Хочу пройти"',
    icon: 'TrendingUp',
    getValue: (s) => s.want,
    thresholds: [1, 5, 10, 25, 50, 100, 200, 500, 1000, 2500],
  },
  {
    id: 'gamer',
    title: 'Геймер',
    description: 'Игры в процессе',
    icon: 'Gamepad',
    getValue: (s) => s.playing,
    thresholds: [1, 3, 5, 10, 20, 50, 100, 200, 500, 1000],
  },
  {
    id: 'marathon',
    title: 'Марафонец',
    description: 'Общее время в играх',
    icon: 'Clock',
    getValue: (s) => s.totalHours,
    thresholds: [100, 250, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000],
  },
];

export default function AchievementsModal({
  isOpen,
  onClose,
  stats,
}: AchievementsModalProps) {
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementDef | null>(null);

  // Escape закрывает сначала детали, потом саму модалку
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedAchievement) {
          setSelectedAchievement(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, selectedAchievement, onClose]);

  if (!isOpen) return null;

  const totalLevels = ACHIEVEMENTS.reduce((sum, a) => {
    const { level } = getAchievementLevel(a.thresholds, a.getValue(stats));
    return sum + level;
  }, 0);

  const maxLevels = ACHIEVEMENTS.length * 10;
  const totalProgress = Math.round((totalLevels / maxLevels) * 100);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-neutral-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative shadow-2xl border border-neutral-800">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 bg-neutral-800 hover:bg-neutral-700 rounded-full flex items-center justify-center transition z-10"
        >
          <X className="w-5 h-5 text-neutral-400" />
        </button>

        <div className="p-8">
          {/* Заголовок */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Достижения</h1>
                <p className="text-sm text-neutral-400">Развивай свой профиль</p>
              </div>
            </div>

            {/* Общий прогресс */}
            <div className="mt-4 bg-neutral-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">Общий прогресс</span>
                <span className="text-sm font-bold text-yellow-400">
                  {totalLevels} / {maxLevels} уровней
                </span>
              </div>
              <div className="w-full h-3 bg-neutral-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${totalProgress}%` }}
                />
              </div>
              <div className="text-xs text-neutral-500 mt-1">{totalProgress}% завершено</div>
            </div>
          </div>

          {/* Сетка достижений */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {ACHIEVEMENTS.map((achievement) => {
              const value = achievement.getValue(stats);
              const { level, progress, nextThreshold } = getAchievementLevel(
                achievement.thresholds,
                value,
              );
              const levelData = ACHIEVEMENT_LEVELS[level - 1] || ACHIEVEMENT_LEVELS[0];
              const Icon = iconMap[achievement.icon] || Trophy;
              const isMaxLevel = level === 10;

              return (
                <button
                  key={achievement.id}
                  onClick={() => setSelectedAchievement(achievement)}
                  className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-left hover:border-neutral-600 transition group"
                  style={{
                    boxShadow: level > 0 ? `0 0 20px ${levelData.glowColor}` : 'none',
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: levelData.color + '20' }}
                    >
                      <Icon className="w-5 h-5" style={{ color: levelData.color }} />
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold" style={{ color: levelData.color }}>
                        Ур. {level}
                      </div>
                      <div className="text-[10px] text-neutral-500">
                        {isMaxLevel ? 'MAX' : `до ${nextThreshold}`}
                      </div>
                    </div>
                  </div>

                  <div className="font-medium text-sm text-white mb-1 group-hover:text-indigo-400 transition">
                    {achievement.title}
                  </div>
                  <div className="text-[10px] text-neutral-500 leading-tight mb-2">
                    {achievement.description}
                  </div>

                  <div className="w-full h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: levelData.color,
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-neutral-500 mt-1">
                    {value} {isMaxLevel ? '(макс.)' : `/ ${nextThreshold}`}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Легенда уровней */}
          <div className="mt-6 pt-6 border-t border-neutral-800">
            <h3 className="text-sm font-medium text-white mb-3">Уровни достижений</h3>
            <div className="flex flex-wrap gap-2">
              {ACHIEVEMENT_LEVELS.map((lvl) => (
                <div
                  key={lvl.level}
                  className="flex items-center gap-1.5 px-2 py-1 bg-neutral-800 rounded-lg"
                >
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: lvl.color }} />
                  <span className="text-xs text-neutral-400">Ур. {lvl.level}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Детали достижения */}
      {selectedAchievement && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={() => setSelectedAchievement(null)}
        >
          <div
            className="bg-neutral-900 rounded-2xl max-w-md w-full p-6 relative border border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedAchievement(null)}
              className="absolute top-4 right-4 w-8 h-8 bg-neutral-800 hover:bg-neutral-700 rounded-full flex items-center justify-center transition"
            >
              <X className="w-4 h-4 text-neutral-400" />
            </button>

            {(() => {
              const value = selectedAchievement.getValue(stats);
              const { level, progress, nextThreshold } = getAchievementLevel(
                selectedAchievement.thresholds,
                value,
              );
              const levelData = ACHIEVEMENT_LEVELS[level - 1] || ACHIEVEMENT_LEVELS[0];
              const Icon = iconMap[selectedAchievement.icon] || Trophy;
              const isMaxLevel = level === 10;

              return (
                <>
                  <div className="flex items-center gap-4 mb-6">
                    <div
                      className="w-16 h-16 rounded-xl flex items-center justify-center"
                      style={{
                        backgroundColor: levelData.color + '20',
                        boxShadow: `0 0 30px ${levelData.glowColor}`,
                      }}
                    >
                      <Icon className="w-8 h-8" style={{ color: levelData.color }} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {selectedAchievement.title}
                      </h2>
                      <p className="text-sm text-neutral-400">
                        {selectedAchievement.description}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: levelData.color + '20',
                            color: levelData.color,
                          }}
                        >
                          Уровень {level}
                        </span>
                        {isMaxLevel && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-yellow-400/20 text-yellow-400">
                            МАКСИМУМ
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-neutral-800 rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-neutral-400">Прогресс</span>
                      <span className="text-sm font-bold text-white">
                        {value} {isMaxLevel ? '(макс.)' : `/ ${nextThreshold}`}
                      </span>
                    </div>
                    <div className="w-full h-3 bg-neutral-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${progress}%`,
                          backgroundColor: levelData.color,
                        }}
                      />
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">
                      {Math.round(progress)}% до следующего уровня
                    </div>
                  </div>

                  {/* Все уровни */}
                  <div>
                    <h3 className="text-sm font-medium text-white mb-3">Все уровни</h3>
                    <div className="space-y-2">
                      {selectedAchievement.thresholds.map((threshold, idx) => {
                        const lvl = idx + 1;
                        const lvlData = ACHIEVEMENT_LEVELS[idx];
                        const isUnlocked = value >= threshold;
                        const isCurrent = lvl === level;

                        return (
                          <div
                            key={lvl}
                            className={`flex items-center gap-3 p-2 rounded-lg transition ${
                              isCurrent ? 'bg-neutral-800 border border-neutral-700' : ''
                            }`}
                          >
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{
                                backgroundColor: isUnlocked
                                  ? lvlData.color + '20'
                                  : 'rgba(115,115,115,0.1)',
                                opacity: isUnlocked ? 1 : 0.4,
                              }}
                            >
                              <span
                                className="text-xs font-bold"
                                style={{ color: isUnlocked ? lvlData.color : '#737373' }}
                              >
                                {lvl}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-white">
                                Уровень {lvl}
                              </div>
                              <div className="text-[10px] text-neutral-500">
                                {threshold} {selectedAchievement.description.toLowerCase()}
                              </div>
                            </div>
                            {isUnlocked ? (
                              <Check
                                className="w-4 h-4 flex-shrink-0"
                                style={{ color: lvlData.color }}
                              />
                            ) : (
                              <Lock className="w-4 h-4 flex-shrink-0 text-neutral-600" />
                            )}
                          </div>
                        );
                      })}
                    </div>
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