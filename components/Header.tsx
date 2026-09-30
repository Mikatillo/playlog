'use client';

import { Gamepad2, Home, Library, LogOut, LogIn, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { UserProfile, calculateLevel } from '@/types/game';

interface HeaderProps {
  profile?: UserProfile;
  levelInfo?: any;
}

export default function Header({ profile, levelInfo }: HeaderProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setUserProfile({
                nickname: data.nickname || user.email?.split('@')[0] || 'Игрок',
                xp: data.xp || 0,
                totalGames: data.total_games || 0,
                completedGames: data.completed_games || 0,
                totalHours: data.total_hours || 0,
              });
            }
          });
      }
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const level = userProfile ? calculateLevel(userProfile.xp).level : 0;
  const displayName = userProfile?.nickname || user?.email?.split('@')[0] || '';

  return (
    <header className="sticky top-0 z-50 glass border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center group-hover:bg-indigo-600 transition">
            <Gamepad2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-lg tracking-tight text-white">PlayLog</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link
            href="/"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              pathname === '/'
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <Home className="w-4 h-4" />
              Главная
            </span>
          </Link>
          <Link
            href="/my-games"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              pathname === '/my-games'
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <Library className="w-4 h-4" />
              Мои игры
            </span>
          </Link>
        </nav>

        <div className="relative">
          {user ? (
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-neutral-900 transition"
            >
              <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                {displayName.substring(0, 2).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-sm font-medium leading-tight text-white">{displayName}</div>
                <div className="text-xs text-neutral-500 leading-tight">Уровень {level}</div>
              </div>
              <ChevronDown className="w-4 h-4 text-neutral-400" />
            </button>
          ) : (
            <Link
              href="/auth"
              className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-neutral-200 transition"
            >
              <LogIn className="w-4 h-4" />
              Войти
            </Link>
          )}

          {showMenu && user && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-neutral-900 rounded-xl border border-neutral-800 shadow-lg py-2 z-50">
                <div className="px-4 py-2 border-b border-neutral-800">
                  <div className="text-sm font-medium text-white">{displayName}</div>
                  <div className="text-xs text-neutral-500">{user.email}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-neutral-800 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Выйти
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}