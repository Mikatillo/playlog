'use client';

import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { GameData, UserProfile } from '@/types/game';

interface AchievementsStats {
  total: number;
  completed: number;
  playing: number;
  want: number;
  dropped: number;
  totalHours: number;
  ratedGames: number;
  reviewsCount: number;
}

interface AuthContextType {
  user: any;
  userId: string | undefined;
  userEmail: string | undefined;
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  userGames: Map<number, GameData>;
  setUserGames: React.Dispatch<React.SetStateAction<Map<number, GameData>>>;
  loading: boolean;
  achievementsStats: AchievementsStats;
}

const defaultProfile: UserProfile = {
  nickname: '',
  avatarUrl: undefined,
  xp: 0,
  totalGames: 0,
  completedGames: 0,
  totalHours: 0,
  coins: 0,
  activeStatusId: null,
  activeBackgroundId: null,
};

const AuthContext = createContext<AuthContextType | null>(null);

// ===== Кеш профиля =====
const CACHE_KEY = 'playlog:profile-cache';

interface CachedData {
  userId: string;
  profile: UserProfile;
  ts: number;
}

function loadCache(): CachedData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CachedData = JSON.parse(raw);
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(userId: string, profile: UserProfile) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ userId, profile, ts: Date.now() }),
    );
  } catch {}
}

function clearCache() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [userGames, setUserGames] = useState<Map<number, GameData>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadForUser = async (u: any) => {
      const [profileRes, gamesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', u.id).maybeSingle(),
        supabase.from('user_games').select('*').eq('user_id', u.id),
      ]);
      if (cancelled) return;

      const p = profileRes.data;
      const emailFallback = u.email?.split('@')[0] || 'Игрок';
      const newProfile: UserProfile = {
        nickname: p?.nickname || emailFallback,
        avatarUrl: p?.avatar_url || undefined,
        xp: p?.xp || 0,
        totalGames: p?.total_games || 0,
        completedGames: p?.completed_games || 0,
        totalHours: p?.total_hours || 0,
        coins: p?.coins || 0,
        activeStatusId: p?.active_status_id || null,
        activeBackgroundId: p?.active_background_id || null,
      };
      setProfile(newProfile);
      saveCache(u.id, newProfile);

      if (!p) {
        await supabase.from('profiles').insert({
          id: u.id,
          nickname: emailFallback,
          xp: 0,
          total_games: 0,
          completed_games: 0,
          total_hours: 0,
          coins: 100,
        });
      }

      if (gamesRes.data) {
        const map = new Map<number, GameData>();
        gamesRes.data.forEach((g) => {
          map.set(g.game_id, {
            rating: g.rating || 0,
            hours: g.hours || 0,
            review: g.review || '',
            status: g.status || 'none',
            xp: 0,
            updatedAt: g.updated_at || undefined,
          });
        });
        setUserGames(map);
      }
    };

    const init = async () => {
      try {
        // 1. Сразу показываем кеш, если он есть — мгновенный рендер шапки
        const cached = loadCache();
        if (cached && !cancelled) {
          setProfile(cached.profile);
          setLoading(false);
        }

        // 2. Проверяем сессию (в фоне)
        const { data: { session } } = await supabase.auth.getSession();
        const u = session?.user ?? null;
        if (cancelled) return;

        // 3. Если кеш есть, но userId не совпадает — сбрасываем
        if (cached && u && cached.userId !== u.id) {
          setProfile(defaultProfile);
          setUserGames(new Map());
          setLoading(true);
        }

        setUser(u);
        if (u) {
          await loadForUser(u);
        } else {
          // Не залогинен — чистим кеш
          clearCache();
          setProfile(defaultProfile);
          setUserGames(new Map());
        }
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      const u = session?.user ?? null;
      setUser(u);
      if (!u) {
        clearCache();
        setUserGames(new Map());
        setProfile(defaultProfile);
      } else {
        loadForUser(u);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Обновляем кеш при изменении профиля из UI
  useEffect(() => {
    if (user?.id && profile.nickname) {
      saveCache(user.id, profile);
    }
  }, [profile, user?.id]);

  // ===== ИСПРАВЛЕНО: useMemo для предотвращения лишних ререндеров =====
  const achievementsStats = useMemo<AchievementsStats>(() => {
    const values = Array.from(userGames.values());
    return {
      total: userGames.size,
      completed: values.filter((d) => d.status === 'completed').length,
      playing: values.filter((d) => d.status === 'playing').length,
      want: values.filter((d) => d.status === 'want').length,
      dropped: values.filter((d) => d.status === 'dropped').length,
      totalHours: values.reduce((sum, d) => sum + (d.hours || 0), 0),
      ratedGames: values.filter((d) => d.rating > 0).length,
      reviewsCount: values.filter(
        (d) => d.review && d.review.length > 0,
      ).length,
    };
  }, [userGames]);

  return (
    <AuthContext.Provider
      value={{
        user,
        userId: user?.id,
        userEmail: user?.email,
        profile,
        setProfile,
        userGames,
        setUserGames,
        loading,
        achievementsStats,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
