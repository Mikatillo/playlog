'use client';

import { useState } from 'react';
import { Gamepad2, Trophy, Menu, X, User, LogOut, Award } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { LevelInfo, UserProfile } from '@/types/game';
import AchievementsModal from './AchievementsModal';

interface HeaderProps {
  profile?: UserProfile;
  levelInfo?: LevelInfo;
  achievementsStats?: {
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

export default function Header({ profile, levelInfo, achievementsStats }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <>
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-500 rounded-lg flex items-center justify-center">
              <Gamepad2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg text-white">PlayLog</span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <a href="/" className="text-sm text-neutral-300 hover:text-white transition">
              Главная
            </a>
            <a href="/my-games" className="text-sm text-neutral-300 hover:text-white transition">
              Мои игры
            </a>
            <button
              onClick={() => setAchievementsOpen(true)}
              className="text-sm text-neutral-300 hover:text-yellow-400 transition flex items-center gap-1.5"
            >
              <Award className="w-4 h-4" />
              Достижения
            </button>
          </nav>

          <div className="flex items-center gap-3">
            {profile && levelInfo && (
              <div className="hidden sm:flex items-center gap-2 bg-neutral-800 rounded-lg px-3 py-1.5">
                <div className="text-right">
                  <div className="text-xs text-neutral-400">Уровень {levelInfo.level}</div>
                  <div className="text-xs font-bold text-indigo-400">{profile.xp} XP</div>
                </div>
                <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                  {levelInfo.level}
                </div>
              </div>
            )}

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 text-neutral-400 hover:text-white transition"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Мобильное меню */}
        {menuOpen && (
          <div className="md:hidden bg-neutral-900 border-t border-neutral-800 px-6 py-4 space-y-3">
            <a href="/" className="block text-sm text-neutral-300 hover:text-white transition py-2">
              Главная
            </a>
            <a href="/my-games" className="block text-sm text-neutral-300 hover:text-white transition py-2">
              Мои игры
            </a>
            <button
              onClick={() => {
                setAchievementsOpen(true);
                setMenuOpen(false);
              }}
              className="block w-full text-left text-sm text-neutral-300 hover:text-yellow-400 transition py-2 flex items-center gap-2"
            >
              <Award className="w-4 h-4" />
              Достижения
            </button>
            {profile && (
              <div className="pt-3 border-t border-neutral-800">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-neutral-400" />
                  <span className="text-sm text-white">{profile.nickname}</span>
                </div>
                <div className="text-xs text-neutral-400">
                  Уровень {levelInfo?.level} • {profile.xp} XP
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="w-full text-left text-sm text-red-400 hover:text-red-300 transition py-2 flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Выйти
            </button>
          </div>
        )}
      </header>

      {/* Модальное окно достижений */}
      <AchievementsModal
        isOpen={achievementsOpen}
        onClose={() => setAchievementsOpen(false)}
        stats={achievementsStats || {
          total: 0,
          completed: 0,
          playing: 0,
          want: 0,
          dropped: 0,
          totalHours: 0,
          ratedGames: 0,
          reviewsCount: 0,
        }}
      />
    </>
  );
}