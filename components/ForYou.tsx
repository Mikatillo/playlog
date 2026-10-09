'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { Game } from '@/types/game';
import { mapRawgGame, RawgGame } from '@/lib/rawg';
import { useAuth } from '@/contexts/AuthContext';
import GameCard from './GameCard';
import GameCardSkeleton from './GameCardSkeleton';

interface ForYouProps {
  onGameClick: (game: Game) => void;
}

const SEED_KEY = 'playlog:foryou:seed';
const SEED_TS_KEY = 'playlog:foryou:ts';
const TTL = 24 * 60 * 60 * 1000; // 24 часа

function getOrCreateSeed(force = false): string {
  if (typeof window === 'undefined') return String(Date.now());

  const now = Date.now();
  const savedSeed = localStorage.getItem(SEED_KEY);
  const savedTs = Number(localStorage.getItem(SEED_TS_KEY) || 0);

  const isFresh = savedSeed && savedTs && now - savedTs < TTL;

  if (!force && isFresh) return savedSeed!;

  const newSeed = String(now) + Math.floor(Math.random() * 100000);
  localStorage.setItem(SEED_KEY, newSeed);
  localStorage.setItem(SEED_TS_KEY, String(now));
  return newSeed;
}

export default function ForYou({ onGameClick }: ForYouProps) {
  const { userId, userGames } = useAuth();
  const [recommendations, setRecommendations] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState<string>('');
  const loadedRef = useRef(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const entries = Array.from(userGames.entries());

        const topByRating = entries
          .filter(([, d]) => d.rating >= 7)
          .sort((a, b) => b[1].rating - a[1].rating)
          .slice(0, 6)
          .map(([id]) => id);

        const topByHours = entries
          .filter(([, d]) => d.hours >= 5)
          .sort((a, b) => b[1].hours - a[1].hours)
          .slice(0, 4)
          .map(([id]) => id);

        const topIds = Array.from(new Set([...topByRating, ...topByHours])).slice(0, 8);
        const allIds = entries.map(([id]) => id);

        // Сид: свежий из кеша или новый при refresh
        const currentSeed = getOrCreateSeed(isRefresh);
        setSeed(currentSeed);

        const url = `/api/games/for-you?all=${allIds.join(',')}&top=${topIds.join(',')}&seed=${currentSeed}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const mapped = (data.results || []).map((g: RawgGame) => mapRawgGame(g));
        setRecommendations(mapped);

        if (mapped.length === 0) {
          setError('Пока не удалось подобрать игры');
        }
      } catch (err: any) {
        console.error('[ForYou] error:', err);
        setError(err.message || 'Ошибка загрузки');
        setRecommendations([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userGames],
  );

  // Загружаем один раз при монтировании
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    load(false);
  }, [load]);

  if (!userId) return null;

  if (loading) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-400" />
          <h2 className="text-lg font-semibold text-white">Для вас</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <GameCardSkeleton key={i} />
          ))}
        </div>
      </section>
    );
  }

  if (recommendations.length === 0) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-400" />
          <h2 className="text-lg font-semibold text-white">Для вас</h2>
        </div>
        <div className="text-center py-8 bg-neutral-900 border border-neutral-800 rounded-xl">
          <p className="text-sm text-neutral-400 mb-3">
            {error || 'Не удалось подобрать рекомендации'}
          </p>
          <button
            onClick={() => load(true)}
            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition"
          >
            Попробовать снова
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <h2 className="text-lg font-semibold text-white truncate">Для вас</h2>
          <span className="hidden sm:inline text-xs text-neutral-500 truncate">
            {userGames.size > 0
              ? 'на основе твоих оценок и часов'
              : 'популярные игры, пока нет истории'}
          </span>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 rounded-lg transition disabled:opacity-50 flex-shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Обновить</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {recommendations.map((game, idx) => (
          <GameCard
            key={`${game.id}-${seed}`}
            game={game}
            onClick={() => onGameClick(game)}
            userGameData={userGames.get(game.id)}
            isAuthenticated={!!userId}
            index={idx}
          />
        ))}
      </div>
    </section>
  );
}