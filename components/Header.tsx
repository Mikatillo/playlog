'use client';

import { Trophy, Gamepad2, Home, Library, Menu, X, Zap, LogOut, LogIn } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { UserProfile, LevelInfo, calculateLevel } from '@/types/game';

interface HeaderProps {
  profile?: UserProfile;
  levelInfo?: LevelInfo;
}

export default function Header({ profile, levelInfo }: HeaderProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userLevelInfo, setUserLevelInfo] = useState<LevelInfo | null>(null);

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
              const prof: UserProfile = {
                nickname: data.nickname || user.email?.split('@')[0] || 'Игрок',
                xp: data.xp || 0,
                totalGames: data.total_games || 0,
                completedGames: data.completed_games || 0,
                totalHours: data.total_hours || 0,
              };
              setUserProfile(prof);
              setUserLevelInfo(calculateLevel(prof.xp));
            }
          });
      }
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  // Определяем, какой профиль показывать
  const displayProfile = user ? userProfile : null;
  const displayLevelInfo = user ? userLevelInfo : null;
  const displayName = displayProfile?.nickname || user?.email?.split('@')[0] || '';
  const level = displayLevelInfo?.level || 1;
  const xp = displayLevelInfo?.xpInLevel || 0;
  const xpToNext = displayLevelInfo?.xpToNext || 100;
  const xpPercent = Math.min((xp / xpToNext) * 100, 100);

  return (
    <header className="sticky top-0 z-40 bg-[#1a1a2e]">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#b142f5] flex items-center justify-center">
              <Gamepad2 className="w-6 h-6 text-[#ffec27]" />
            </div>
            <div className="font-pixel text-sm">
              <span className="text-[#ff004d]">PLAY</span>
              <span className="text-[#00e436]">LOG</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-2 ml-6">
            <Link
              href="/"
              className={`font-pixel text-[10px] px-3 py-2 border-2 flex items-center gap-2 transition ${
                pathname === '/'
                  ? 'bg-[#ffec27] text-[#0f0f1e] border-[#ffec27]'
                  : 'bg-[#0f0f1e] text-[#fcfcfc] border-[#747474] hover:border-[#ffec27]'
              }`}
            >
              <Home className="w-3 h-3" /> ГЛАВНАЯ
            </Link>
            <Link
              href="/my-games"
              className={`font-pixel text-[10px] px-3 py-2 border-2 flex items-center gap-2 transition ${
                pathname === '/my-games'
                  ? 'bg-[#ffec27] text-[#0f0f1e] border-[#ffec27]'
                  : 'bg-[#0f0f1e] text-[#fcfcfc] border-[#747474] hover:border-[#ffec27]'
              }`}
            >
              <Library className="w-3 h-3" /> МОИ ИГРЫ
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden bg-[#0f0f1e] border-2 border-[#747474] p-2"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          {user ? (
            <div className="hidden md:flex items-center gap-3 bg-[#0f0f1e] px-3 py-2 border-2 border-[#00e436]">
              <div className="w-8 h-8 bg-[#ff004d] flex items-center justify-center font-pixel text-xs">
                {displayName.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-pixel text-[10px] text-[#ffec27]">{displayName}</div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-[#0f0f1e] border border-[#747474] relative overflow-hidden">
                    <div 
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#b142f5] to-[#00e436]" 
                      style={{ width: `${xpPercent}%` }}
                    ></div>
                  </div>
                  <span className="font-pixel text-[8px] text-[#747474] flex items-center gap-1">
                    <Zap className="w-2 h-2 text-[#ffec27]" /> {level}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="ml-2 bg-[#ff004d] p-2 hover:bg-[#ff3366] transition"
                title="Выйти"
              >
                <LogOut className="w-4 h-4 text-white" />
              </button>
            </div>
          ) : (
            <Link
              href="/auth"
              className="hidden md:flex bg-[#00e436] text-[#0f0f1e] font-pixel text-[10px] px-4 py-2 hover:bg-[#00ff40] items-center gap-2"
            >
              <LogIn className="w-3 h-3" /> ВОЙТИ
            </Link>
          )}
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-[#1a1a2e] border-t-2 border-[#b142f5] p-4 space-y-3">
          <div className="flex flex-col gap-2">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="font-pixel text-[10px] px-3 py-2 border-2 bg-[#0f0f1e] border-[#747474]"
            >
              🏠 ГЛАВНАЯ
            </Link>
            <Link
              href="/my-games"
              onClick={() => setMobileMenuOpen(false)}
              className="font-pixel text-[10px] px-3 py-2 border-2 bg-[#0f0f1e] border-[#747474]"
            >
              📚 МОИ ИГРЫ
            </Link>
            {user ? (
              <button
                onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                className="font-pixel text-[10px] px-3 py-2 border-2 bg-[#ff004d] text-white border-[#ff004d]"
              >
                🚪 ВЫЙТИ
              </button>
            ) : (
              <Link
                href="/auth"
                onClick={() => setMobileMenuOpen(false)}
                className="font-pixel text-[10px] px-3 py-2 border-2 bg-[#00e436] text-[#0f0f1e] border-[#00e436]"
              >
                 ВОЙТИ
              </Link>
            )}
          </div>
          {user && (
            <div className="flex items-center gap-2 bg-[#0f0f1e] p-2 border-2 border-[#00e436]">
              <div className="w-8 h-8 bg-[#ff004d] flex items-center justify-center font-pixel text-xs">
                {displayName.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-pixel text-[10px] text-[#ffec27]">{displayName}</div>
                <div className="font-pixel text-[8px] text-[#747474]">
                  LVL {level} • {xp}/{xpToNext} XP
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}