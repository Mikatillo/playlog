'use client';

import { useEffect, useMemo, useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import type { Game } from '@/types/game';
import { useAuth } from '@/contexts/AuthContext';
import { fetchGamesByIds } from '@/lib/games-client';
import { Rail, RailCard } from './Rail';
import { useGameUpdates, patchGameInList } from '@/lib/game-events';

export default function ContinuePlaying({ onGameClick }: { onGameClick: (g: Game) => void }) {
  const { userId, userGames } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  useGameUpdates((g) => setGames((prev) => patchGameInList(prev, g)));

  const ids = useMemo(
    () =>
      Array.from(userGames.entries())
        .filter(([, d]) => d.status === 'playing')
        .sort((a, b) => (b[1].updatedAt || '').localeCompare(a[1].updatedAt || ''))
        .slice(0, 12)
        .map(([id]) => id),
    [userGames],
  );
  const key = ids.join(',');

  useEffect(() => {
    if (ids.length === 0) {
      setGames([]);
      return;
    }
    let cancelled = false;
    fetchGamesByIds(ids).then((list) => {
      if (!cancelled) setGames(list);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!userId || games.length === 0) return null;

  return (
    <Rail
      title={
        <>
          <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Gamepad2 className="w-4 h-4 text-white" />
          </span>
          Продолжить играть
        </>
      }
      subtitle="Игры со статусом «Играю»"
    >
      {games.map((g) => {
        const d = userGames.get(g.id);
        return (
          <RailCard
            key={g.id}
            game={g}
            userData={d}
            meta={d?.hours ? `Наиграно ${d.hours} ч.` : g.genre}
            onClick={() => onGameClick(g)}
          />
        );
      })}
    </Rail>
  );
}
