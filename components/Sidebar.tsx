'use client';

import { TrendingUp, Zap, Trophy } from 'lucide-react';
import { LevelInfo, UserProfile } from '@/types/game';

interface SidebarProps {
  profile?: UserProfile;
  levelInfo?: LevelInfo;
}

export default function Sidebar({ profile, levelInfo }: SidebarProps) {
  const xpPercent = levelInfo ? Math.min((levelInfo.xpInLevel / levelInfo.xpToNext) * 100, 100) : 0;
  const level = levelInfo?.level || 1;

  return (
    <aside className="w-full lg:w-72 space-y-6">
      <div className="bg-[#1a1a2e] border-2 border-[#ffec27] p-4">
        <h3 className="font-pixel text-xs mb-3 text-[#ffec27] flex items-center gap-2">
          <Zap className="w-4 h-4" /> УРОВЕНЬ {level}
        </h3>
        <div className="w-full h-3 bg-[#0f0f1e] border-2 border-[#747474] mb-2 relative overflow-hidden">
          <div 
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#b142f5] to-[#ffec27] transition-all duration-500" 
            style={{ width: `${xpPercent}%` }}
          ></div>
        </div>
        <div className="font-pixel text-[8px] text-[#747474] text-center">
          {levelInfo?.xpInLevel || 0} / {levelInfo?.xpToNext || 100} XP
        </div>
      </div>

      <div className="bg-[#1a1a2e] border-2 border-[#00e436] p-4">
        <h3 className="font-pixel text-xs mb-4 text-[#00e436] flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />ТОП
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-lg border-b border-dashed border-[#747474] pb-1">
            <span className="font-pixel text-[10px] text-[#ffec27]">1.</span>
            <span className="truncate">Baldur's Gate 3</span>
            <span className="font-pixel text-[10px] text-[#747474]">12.4k</span>
          </div>
          <div className="flex items-center justify-between text-lg border-b border-dashed border-[#747474] pb-1">
            <span className="font-pixel text-[10px] text-[#29adff]">2.</span>
            <span className="truncate">Elden Ring</span>
            <span className="font-pixel text-[10px] text-[#747474]">9.8k</span>
          </div>
        </div>
      </div>

      <div className="bg-[#1a1a2e] border-2 border-[#b142f5] p-4">
        <h3 className="font-pixel text-[10px] mb-3 text-[#b142f5]">СТАТИСТИКА</h3>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="bg-[#0f0f1e] border-2 border-[#ff004d] p-3">
            <div className="font-pixel text-xl text-[#ffec27]">{profile?.completedGames || 4}</div>
            <div className="font-pixel text-[8px] text-[#747474] mt-1">DONE</div>
          </div>
          <div className="bg-[#0f0f1e] border-2 border-[#29adff] p-3">
            <div className="font-pixel text-xl text-[#00e436]">{profile?.totalHours || 86}h</div>
            <div className="font-pixel text-[8px] text-[#747474] mt-1">PLAYED</div>
          </div>
        </div>
      </div>
    </aside>
  );
}