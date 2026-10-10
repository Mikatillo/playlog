'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Gamepad2, Menu, X, LogOut, Award, Pencil, AlertTriangle,
  User as UserIcon, Home, Library, Search, Calendar, Loader2, ShoppingBag,
  Users, ChevronDown, Coins,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { calculateLevel, Game } from '@/types/game';
import { mapRawgGame, RawgGame } from '@/lib/rawg';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import AchievementsModal from './AchievementsModal';
import EditProfileModal from './EditProfileModal';

export default function Header() {
  const { profile, userId, userEmail, loading, setProfile, achievementsStats } = useAuth();
  const { showToast } = useToast();
  const pathname = usePathname();
  const router = useRouter();

  const [menuOpen, setMenuOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [newFollowersCount, setNewFollowersCount] = useState(0);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Game[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const mobileSearchWrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const levelInfo = calculateLevel(profile.xp);
  const isLoggedIn = !!userId;
  const hasNickname = !!profile.nickname && profile.nickname !== 'Игрок';
  const initials = hasNickname ? profile.nickname.substring(0, 2).toUpperCase() : '';

  // Загрузка счётчика новых подписчиков
  useEffect(() => {
    if (!userId) return;
    const lastVisit = localStorage.getItem('playlog:last_friends_visit');
    if (!lastVisit) {
      localStorage.setItem('playlog:last_friends_visit', new Date().toISOString());
      return;
    }
    fetch(`/api/follows/new-count?user_id=${userId}&since=${lastVisit}`)
      .then((r) => r.json())
      .then((data) => setNewFollowersCount(data.count || 0))
      .catch(() => {});
  }, [userId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setLogoutConfirm(false);
    setUserMenuOpen(false);
    setMenuOpen(false);
    showToast('Ты вышел из аккаунта', 'info');
    router.push('/');
    router.refresh();
  };

  const handleFriendsClick = () => {
    setUserMenuOpen(false);
    setMenuOpen(false);
    setNewFollowersCount(0);
    localStorage.setItem('playlog:last_friends_visit', new Date().toISOString());
  };

  const fetchSuggestions = async (value: string) => {
    if (value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setSuggestLoading(true);
    try {
      const res = await fetch(`/api/games/search?search=${encodeURIComponent(value)}`);
      const data = await res.json();
      const mapped = (data.results || []).slice(0, 6).map((g: RawgGame) => mapRawgGame(g));
      setSuggestions(mapped);
      setShowSuggestions(true);
    } catch (err) {
      console.error('Suggestions error:', err);
    }
    setSuggestLoading(false);
  };

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 250);
  };

  const submitSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setShowSuggestions(false);

    if (pathname !== '/') {
      sessionStorage.setItem('pendingSearch', q);
      router.push('/');
    } else {
      window.dispatchEvent(new CustomEvent('playlog:search', { detail: { query: q } }));
    }
    setSearchOpen(false);
  };

  const handleSuggestionClick = (game: Game) => {
    setShowSuggestions(false);
    setQuery('');
    setSearchOpen(false);

    if (pathname === '/') {
      window.dispatchEvent(new CustomEvent('playlog:openGame', { detail: { game } }));
    } else {
      try {
        sessionStorage.setItem('pendingOpenGame', JSON.stringify(game));
      } catch {}
      router.push('/');
    }
  };

  const clearSearch = () => {
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    if (pathname === '/') {
      window.dispatchEvent(new CustomEvent('playlog:search', { detail: { query: '' } }));
    }
  };

  useEffect(() => {
    if (!showSuggestions) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideDesktop = searchWrapRef.current?.contains(target);
      const insideMobile = mobileSearchWrapRef.current?.contains(target);
      if (!insideDesktop && !insideMobile) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSuggestions]);

  useEffect(() => {
    const handler = (e: Event) => {
      const q = (e as CustomEvent).detail?.query || '';
      setQuery(q);
      if (!q) {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };
    window.addEventListener('playlog:search', handler);
    return () => window.removeEventListener('playlog:search', handler);
  }, []);

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

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUserMenuOpen(false);
        setMenuOpen(false);
        setLogoutConfirm(false);
        setSearchOpen(false);
        setShowSuggestions(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const AvatarBlock = ({ size }: { size: 'sm' | 'md' }) => {
    const cls = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
    return (
      <div
        className={`relative ${cls} rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-white flex-shrink-0`}
      >
        {profile.avatarUrl ? (
          <Image
            src={profile.avatarUrl}
            alt={profile.nickname || 'avatar'}
            fill
            sizes={size === 'sm' ? '32px' : '40px'}
            className="object-cover"
            unoptimized
          />
        ) : hasNickname ? (
          initials
        ) : (
          <UserIcon className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />
        )}
      </div>
    );
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname?.startsWith(href);
  };

  const navLinkClass = (href: string) => {
    const active = isActive(href);
    return `nav-link flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
      active
        ? 'bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30'
        : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
    }`;
  };

  const SuggestionsList = () => {
    if (!showSuggestions) return null;

    return (
      <div className="absolute left-0 right-0 top-full mt-2 bg-neutral-900 rounded-xl border border-neutral-800 shadow-2xl z-50 overflow-hidden">
        {suggestLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
            <span className="ml-2 text-xs text-neutral-400">Ищем...</span>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-neutral-500">
            Ничего не найдено
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto">
            {suggestions.map((game) => (
              <button
                key={game.id}
                onClick={() => handleSuggestionClick(game)}
                className="w-full flex items-center gap-3 p-3 hover:bg-neutral-800 transition text-left border-b border-neutral-800 last:border-b-0"
              >
                <div className="relative w-10 h-14 rounded-lg overflow-hidden bg-neutral-800 flex-shrink-0">
                  {game.cover ? (
                    <Image
                      src={game.cover}
                      alt={game.title}
                      fill
                      sizes="40px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Gamepad2 className="w-4 h-4 text-neutral-600" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-white truncate">
                    {game.title}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-neutral-400 truncate">
                      {game.genre}
                    </span>
                    {game.year > 0 && (
                      <>
                        <span className="text-xs text-neutral-600">•</span>
                        <span className="text-xs text-neutral-400">{game.year}</span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center gap-3 md:gap-4">
          {/* Логотип */}
          <Link
            href="/"
            className="flex items-center gap-2.5 flex-shrink-0 rounded-lg hover:opacity-80 transition"
            aria-label="На главную"
          >
            <div className="w-9 h-9 bg-indigo-500 rounded-lg flex items-center justify-center">
              <Gamepad2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg text-white hidden sm:inline">PlayLog</span>
          </Link>

          {/* Навигация */}
          <nav className="hidden lg:flex items-center gap-1 flex-shrink-0">
            <Link href="/" className={navLinkClass('/')}>
              <Home className="w-4 h-4" />
              Главная
            </Link>
            <Link href="/my-games" className={navLinkClass('/my-games')}>
              <Library className="w-4 h-4" />
              Мои игры
            </Link>
            <Link href="/releases" className={navLinkClass('/releases')}>
              <Calendar className="w-4 h-4" />
              Релизы
            </Link>
            <button
              onClick={() => setAchievementsOpen(true)}
              className="nav-link flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-neutral-300 hover:text-yellow-400 hover:bg-neutral-800 transition"
            >
              <Award className="w-4 h-4" />
              Достижения
            </button>
            <Link
              href="/shop"
              className={navLinkClass('/shop')}
            >
              <ShoppingBag className="w-4 h-4" />
              Магазин
            </Link>
          </nav>

          {/* Поиск (desktop) */}
          <div ref={searchWrapRef} className="hidden md:block flex-1 max-w-[220px] lg:max-w-xs xl:max-w-sm mx-auto relative">
            <form onSubmit={submitSearch}>
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                  }}
                  placeholder="Поиск игр..."
                  className="w-full bg-neutral-800/70 border border-neutral-700/50 rounded-lg pl-9 pr-8 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 transition"
                />
                {query && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-neutral-700 rounded transition"
                    aria-label="Очистить"
                  >
                    <X className="w-3.5 h-3.5 text-neutral-400" />
                  </button>
                )}
              </div>
            </form>
            <SuggestionsList />
          </div>

          {/* Правый блок */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0 ml-auto lg:ml-0">
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className="md:hidden p-2 text-neutral-400 hover:text-white transition"
              aria-label="Поиск"
            >
              {searchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
            </button>

            {loading ? (
              <div className="w-24 md:w-32 h-10 bg-neutral-800 rounded-lg animate-pulse" />
            ) : isLoggedIn ? (
              <div className="hidden sm:flex items-center gap-2 relative" ref={userMenuRef}>
                <Link
                  href="/shop"
                  title="Монеты · открыть магазин"
                  className="coin-pill flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-sm font-semibold hover:bg-amber-500/20 hover:border-amber-400/50 transition"
                >
                  <Coins className="w-4 h-4" />
                  {(profile.coins || 0).toLocaleString('ru-RU')}
                </Link>
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg pl-1.5 pr-3 py-1.5 transition"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                >
                  <AvatarBlock size="sm" />
                  <div className="text-left leading-tight max-w-[120px] lg:max-w-[140px]">
                    <div className="text-sm font-medium text-white truncate">
                      {profile.nickname || 'Игрок'}
                    </div>
                    <div className="text-xs text-neutral-400">
                      Уровень {levelInfo.level}
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-neutral-400 ml-1" />
                </button>

                {userMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-2 w-56 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden z-50"
                  >
                    <div className="px-4 py-3 border-b border-neutral-800">
                      <div className="text-sm font-medium text-white truncate">
                        {profile.nickname || 'Игрок'}
                      </div>
                      <div className="text-xs text-neutral-400">
                        {profile.xp} XP • Уровень {levelInfo.level}
                      </div>
                    </div>

                    <Link
                      href={`/user/${userId}`}
                      onClick={() => setUserMenuOpen(false)}
                      className="w-full px-4 py-2.5 text-left text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition flex items-center gap-2"
                    >
                      <UserIcon className="w-4 h-4" />
                      Мой профиль
                    </Link>

                    {/* КНОПКА ДРУЗЬЯ С БЕЙДЖЕМ */}
                    <Link
                      href="/friends"
                      onClick={handleFriendsClick}
                      className="w-full px-4 py-2.5 text-left text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Друзья
                      </span>
                      {newFollowersCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-bold min-w-[20px] text-center">
                          +{newFollowersCount}
                        </span>
                      )}
                    </Link>

                    <Link
                      href="/shop"
                      onClick={() => setUserMenuOpen(false)}
                      className="w-full px-4 py-2.5 text-left text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition flex items-center gap-2"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      Магазин
                    </Link>

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        setEditProfileOpen(true);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition flex items-center gap-2"
                    >
                      <Pencil className="w-4 h-4" />
                      Настройки профиля
                    </button>

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        setLogoutConfirm(true);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-neutral-800 hover:text-red-300 transition flex items-center gap-2 border-t border-neutral-800"
                    >
                      <LogOut className="w-4 h-4" />
                      Выйти из аккаунта
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/auth"
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition"
              >
                <UserIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Войти</span>
              </Link>
            )}

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden p-2 text-neutral-400 hover:text-white transition"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {searchOpen && (
          <div ref={mobileSearchWrapRef} className="md:hidden border-t border-neutral-800 px-4 py-3 relative">
            <form onSubmit={submitSearch} className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                placeholder="Поиск игр..."
                autoFocus
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-9 pr-9 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-neutral-700 rounded transition"
                  aria-label="Очистить"
                >
                  <X className="w-4 h-4 text-neutral-400" />
                </button>
              )}
            </form>
            <SuggestionsList />
          </div>
        )}

        {/* Мобильное меню */}
        {menuOpen && (
          <div className="lg:hidden bg-neutral-900 border-t border-neutral-800 px-6 py-4 space-y-3">
            {isLoggedIn && (
              <div className="flex items-center gap-3 pb-3 border-b border-neutral-800">
                <AvatarBlock size="md" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">
                    {profile.nickname || 'Игрок'}
                  </div>
                  <div className="text-xs text-neutral-400">
                    Уровень {levelInfo.level} • {profile.xp} XP • {profile.coins || 0} монет
                  </div>
                </div>
              </div>
            )}

            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-2.5 text-sm font-medium transition py-2.5 px-3 rounded-lg ${
                isActive('/')
                  ? 'bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <Home className="w-4 h-4" />
              Главная
            </Link>
            <Link
              href="/my-games"
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-2.5 text-sm font-medium transition py-2.5 px-3 rounded-lg ${
                isActive('/my-games')
                  ? 'bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <Library className="w-4 h-4" />
              Мои игры
            </Link>
            <Link
              href="/releases"
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-2.5 text-sm font-medium transition py-2.5 px-3 rounded-lg ${
                isActive('/releases')
                  ? 'bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Релизы
            </Link>
            <button
              onClick={() => {
                setAchievementsOpen(true);
                setMenuOpen(false);
              }}
              className="w-full text-left text-sm font-medium text-neutral-300 hover:text-yellow-400 hover:bg-neutral-800 transition py-2.5 px-3 rounded-lg flex items-center gap-2"
            >
              <Award className="w-4 h-4" />
              Достижения
            </button>

            <Link
              href="/shop"
              onClick={() => setMenuOpen(false)}
              className={`w-full text-left text-sm font-medium transition py-2.5 px-3 rounded-lg flex items-center gap-2 ${
                isActive('/shop')
                  ? 'bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              Магазин
            </Link>

            {isLoggedIn && (
              <>
                <Link
                  href={`/user/${userId}`}
                  onClick={() => setMenuOpen(false)}
                  className="w-full text-left text-sm font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition py-2.5 px-3 rounded-lg flex items-center gap-2"
                >
                  <UserIcon className="w-4 h-4" />
                  Мой профиль
                </Link>
                
                {/* КНОПКА ДРУЗЬЯ В МОБИЛЬНОМ МЕНЮ */}
                <Link
                  href="/friends"
                  onClick={handleFriendsClick}
                  className="w-full text-left text-sm font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition py-2.5 px-3 rounded-lg flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Друзья
                  </span>
                  {newFollowersCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-bold">
                      +{newFollowersCount}
                    </span>
                  )}
                </Link>

                <button
                  onClick={() => {
                    setEditProfileOpen(true);
                    setMenuOpen(false);
                  }}
                  className="w-full text-left text-sm font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition py-2.5 px-3 rounded-lg flex items-center gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  Настройки профиля
                </button>
              </>
            )}

            {isLoggedIn ? (
              <button
                onClick={() => {
                  setLogoutConfirm(true);
                  setMenuOpen(false);
                }}
                className="w-full text-left text-sm font-medium text-red-400 hover:text-red-300 hover:bg-neutral-800 transition py-2.5 px-3 rounded-lg flex items-center gap-2 border-t border-neutral-800 pt-3 mt-2"
              >
                <LogOut className="w-4 h-4" />
                Выйти
              </button>
            ) : (
              <Link
                href="/auth"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition py-2.5 px-3 rounded-lg border-t border-neutral-800 pt-3 mt-2"
              >
                <UserIcon className="w-4 h-4" />
                Войти
              </Link>
            )}
          </div>
        )}
      </header>

      <AchievementsModal
        isOpen={achievementsOpen}
        onClose={() => setAchievementsOpen(false)}
        stats={achievementsStats}
      />

      {isLoggedIn && (
        <EditProfileModal
          isOpen={editProfileOpen}
          onClose={() => setEditProfileOpen(false)}
          profile={profile}
          userId={userId!}
          userEmail={userEmail}
          onUpdate={(updated) => {
            setProfile((prev) => ({ ...prev, ...updated }));
          }}
        />
      )}

      {logoutConfirm && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
          onClick={() => setLogoutConfirm(false)}
        >
          <div
            className="bg-neutral-900 rounded-2xl max-w-sm w-full p-6 border border-neutral-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Выйти из аккаунта?</h2>
              <p className="text-sm text-neutral-400 mb-6">
                Ты всегда сможешь зайти обратно
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleLogout}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-3 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Выйти
                </button>
                <button
                  onClick={() => setLogoutConfirm(false)}
                  className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium py-3 rounded-lg transition"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
