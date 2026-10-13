'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { Game } from '@/types/game';
import { useAuth } from '@/contexts/AuthContext';
import { Rail, RailCard } from './Rail';

interface ForYouProps {
  onGameClick: (game: Game) => void;
}

interface Recommended extends Game {
  reason?: string;
}

const SEEN_KEY = 'playlog:foryou-seen';
const SEEN_LIMIT = 36;

function readSeen(): number[] {
  try {
    return JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeSeen(ids: number[]) {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-SEEN_LIMIT)));
  } catch {}
}

export default function ForYou({ onGameClick }: ForYouProps) {
  const { userId, userGames } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommended[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const loadedRef = useRef(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const entries = Array.from(userGames.entries());

        // Вкус считаем по оценкам и часам: чем выше оценка и больше часов, тем важнее игра
        const weighted = entries
          .filter(([, d]) => d.status !== 'want' && (d.rating >= 7 || d.hours >= 5 || d.status === 'completed'))
          .map(([id, d]) => ({ id, w: (d.rating || 5) * 2 + Math.min(d.hours, 100) / 5 }))
          .sort((a, b) => b.w - a.w)
          .slice(0, 8)
          .map((x) => x.id);

        const allIds = entries.map(([id]) => id).slice(0, 300);
        const seen = readSeen();
        const seed = String(Date.now());

        const url = `/api/games/for-you?all=${allIds.join(',')}&top=${weighted.join(',')}&seen=${seen.join(',')}&seed=${seed}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const mapped: Recommended[] = (data.results || []) as Recommended[];
        setRecommendations(mapped);
        setRound((r) => r + 1);
        writeSeen([...seen, ...mapped.map((g) => g.id)]);

        if (mapped.length === 0) setError('Пока не удалось подобрать игры');
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

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    load(false);
  }, [load]);

  if (!userId) return null;

  const title = (
    <>
      <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
        <Sparkles className="w-4 h-4 text-white" />
      </span>
      Для вас
    </>
  );

  const refreshButton = (
    <button
      onClick={() => load(true)}
      disabled={refreshing || loading}
      className="flex items-center gap-1.5 px-3 h-8 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 border border-neutral-800 hover:border-neutral-600 rounded-lg transition disabled:opacity-50"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
      <span className="hidden sm:inline">Другие игры</span>
    </button>
  );

  const subtitle =
    userGames.size > 0
      ? 'Подобрано по твоим оценкам и часам — свежие игры, без повторов'
      : 'Пока нет истории — показываем свежие и хорошо оценённые игры';

  if (loading) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">{title}</h2>
        <div className="flex gap-3 md:gap-4 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[236px] md:w-[272px] h-[200px] rounded-2xl bg-neutral-900 border border-neutral-800 animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (recommendations.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">{title}</h2>
        <div className="text-center py-8 bg-neutral-900 border border-neutral-800 rounded-2xl">
          <p className="text-sm text-neutral-400 mb-3">{error || 'Не удалось подобрать рекомендации'}</p>
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
    <Rail title={title} subtitle={subtitle} action={refreshButton} resetKey={round}>
      {recommendations.map((game, idx) => (
        <RailCard
          key={`${game.id}-${round}`}
          game={game}
          badge={game.reason}
          userData={userGames.get(game.id)}
          onClick={() => onGameClick(game)}
          priority={idx < 3}
        />
      ))}
    </Rail>
  );
}
