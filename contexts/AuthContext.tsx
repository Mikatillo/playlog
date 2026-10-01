'use client';

import { createContext, useContext, useEffect, useState } from 'react';
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
};

const AuthContext = createContext<AuthContextType | null>(null);

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

      // ВСЕГДА выставляем профиль, даже если строки нет — используем email как fallback
      const p = profileRes.data;
      const emailFallback = u.email?.split('@')[0] || 'Игрок';
      setProfile({
        nickname: p?.nickname || emailFallback,
        avatarUrl: p?.avatar_url || undefined,
        xp: p?.xp || 0,
        totalGames: p?.total_games || 0,
        completedGames: p?.completed_games || 0,
        totalHours: p?.total_hours || 0,
      });

      // Если строки в profiles нет — создаём её автоматически
      if (!p) {
        await supabase.from('profiles').insert({
          id: u.id,
          nickname: emailFallback,
          xp: 0,
          total_games: 0,
          completed_games: 0,
          total_hours: 0,
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
          });
        });
        setUserGames(map);
      }
    };

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const u = session?.user ?? null;
        if (cancelled) return;
        setUser(u);
        if (u) await loadForUser(u);
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

  const achievementsStats: AchievementsStats = {
    total: userGames.size,
    completed: Array.from(userGames.values()).filter((d) => d.status === 'completed').length,
    playing: Array.from(userGames.values()).filter((d) => d.status === 'playing').length,
    want: Array.from(userGames.values()).filter((d) => d.status === 'want').length,
    dropped: Array.from(userGames.values()).filter((d) => d.status === 'dropped').length,
    totalHours: Array.from(userGames.values()).reduce((s, d) => s + (d.hours || 0), 0),
    ratedGames: Array.from(userGames.values()).filter((d) => d.rating > 0).length,
    reviewsCount: Array.from(userGames.values()).filter(
      (d) => d.review && d.review.length > 0,
    ).length,
  };

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