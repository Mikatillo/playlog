'use client';

import { Trophy, Zap, Target, Clock, TrendingUp } from 'lucide-react';
import { UserProfile, LevelInfo } from '@/types/game';

interface SidebarProps {
  profile: UserProfile;
  levelInfo: LevelInfo;
}

export default function Sidebar({ profile, levelInfo }: SidebarProps) {
  const xpPercent = Math.min((levelInfo.xpInLevel / levelInfo.xpToNext) * 100, 100);

  return (
    <aside className="w-full lg:w-72 space-y-4">
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
            {profile.nickname.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-white">{profile.nickname}</h3>
            <p className="text-sm text-neutral-400">Уровень {levelInfo.level}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-neutral-400">Прогресс</span>
            <span className="font-medium text-white">
              {levelInfo.xpInLevel} / {levelInfo.xpToNext} XP
            </span>
          </div>
          <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-5">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-500" />
          Статистика
        </h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-400 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-neutral-600" />
              Всего игр
            </span>
            <span className="font-semibold text-white">{profile.totalGames}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-400 flex items-center gap-2">
              <Target className="w-4 h-4 text-neutral-600" />
              Пройдено
            </span>
            <span className="font-semibold text-white">{profile.completedGames}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-400 flex items-center gap-2">
              <Clock className="w-4 h-4 text-neutral-600" />
              Часов наиграно
            </span>
            <span className="font-semibold text-white">{profile.totalHours}ч</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-400 flex items-center gap-2">
              <Zap className="w-4 h-4 text-neutral-600" />
              Всего XP
            </span>
            <span className="font-semibold text-white">{profile.xp}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}