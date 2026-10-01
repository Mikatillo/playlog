'use client';

import { useState, useEffect, useRef } from 'react';
import { Gamepad2, Menu, X, LogOut, Award, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { LevelInfo, UserProfile } from '@/types/game';
import AchievementsModal from './AchievementsModal';
import EditProfileModal from './EditProfileModal';

interface HeaderProps {
  profile?: UserProfile;
  levelInfo?: LevelInfo;
  userId?: string;
  onProfileUpdate?: (updated: Partial<UserProfile>) => void;
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

export default function Header({
  profile,
  levelInfo,
  userId,
  onProfileUpdate,
  achievementsStats,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  // Закрытие выпадающего меню по клику вне
  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  const initials = profile?.nickname
    ? profile.nickname.substring(0, 2).toUpperCase()
    : '??';

  const showUserMenu = !!(profile && levelInfo);

  return (
    <>
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          {/* Логотип */}
          <a
            href="/"
            className="flex items-center gap-3 rounded-lg -m-1 p-1 hover:opacity-80 transition"
            aria-label="На главную"
          >
            <div className="w-9 h-9 bg-indigo-500 rounded-lg flex items-center justify-center">
              <Gamepad2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg text-white">PlayLog</span>
          </a>

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
            {/* Меню пользователя (десктоп) */}
            {showUserMenu && (
              <div className="hidden sm:block relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg pl-1.5 pr-3 py-1.5 transition"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {initials}
                  </div>
                  <div className="text-left leading-tight max-w-[140px]">
                    <div className="text-sm font-medium text-white truncate">
                      {profile!.nickname}
                    </div>
                    <div className="text-xs text-neutral-400">
                      Уровень {levelInfo!.level}
                    </div>
                  </div>
                </button>

                {userMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-2 w-56 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden z-50"
                  >
                    <div className="px-4 py-3 border-b border-neutral-800">
                      <div className="text-sm font-medium text-white truncate">
                        {profile!.nickname}
                      </div>
                      <div className="text-xs text-neutral-400">
                        {profile!.xp} XP • Уровень {levelInfo!.level}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        setEditProfileOpen(true);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition flex items-center gap-2"
                      role="menuitem"
                    >
                      <Pencil className="w-4 h-4" />
                      Редактировать профиль
                    </button>

                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-neutral-800 hover:text-red-300 transition flex items-center gap-2 border-t border-neutral-800"
                      role="menuitem"
                    >
                      <LogOut className="w-4 h-4" />
                      Выйти из аккаунта
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Кнопка мобильного меню */}
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
            {profile && levelInfo && (
              <div className="flex items-center gap-3 pb-3 border-b border-neutral-800">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">
                    {profile.nickname}
                  </div>
                  <div className="text-xs text-neutral-400">
                    Уровень {levelInfo.level} • {profile.xp} XP
                  </div>
                </div>
              </div>
            )}

            <a href="/" className="block text-sm text-neutral-300 hover:text-white transition py-2">
              Главная
            </a>
            <a
              href="/my-games"
              className="block text-sm text-neutral-300 hover:text-white transition py-2"
            >
              Мои игры
            </a>
            <button
              onClick={() => {
                setAchievementsOpen(true);
                setMenuOpen(false);
              }}
              className="w-full text-left text-sm text-neutral-300 hover:text-yellow-400 transition py-2 flex items-center gap-2"
            >
              <Award className="w-4 h-4" />
              Достижения
            </button>

            {profile && (
              <button
                onClick={() => {
                  setEditProfileOpen(true);
                  setMenuOpen(false);
                }}
                className="w-full text-left text-sm text-neutral-300 hover:text-white transition py-2 flex items-center gap-2"
              >
                <Pencil className="w-4 h-4" />
                Редактировать профиль
              </button>
            )}

            <button
              onClick={handleLogout}
              className="w-full text-left text-sm text-red-400 hover:text-red-300 transition py-2 flex items-center gap-2 border-t border-neutral-800 pt-3"
            >
              <LogOut className="w-4 h-4" />
              Выйти
            </button>
          </div>
        )}
      </header>

      <AchievementsModal
        isOpen={achievementsOpen}
        onClose={() => setAchievementsOpen(false)}
        stats={
          achievementsStats || {
            total: 0,
            completed: 0,
            playing: 0,
            want: 0,
            dropped: 0,
            totalHours: 0,
            ratedGames: 0,
            reviewsCount: 0,
          }
        }
      />

      {profile && userId && (
        <EditProfileModal
          isOpen={editProfileOpen}
          onClose={() => setEditProfileOpen(false)}
          currentNickname={profile.nickname}
          userId={userId}
          onSaved={(newNickname) => {
            onProfileUpdate?.({ nickname: newNickname });
          }}
        />
      )}
    </>
  );
}