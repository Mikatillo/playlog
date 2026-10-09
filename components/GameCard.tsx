'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Star, Clock, Heart, Gamepad, Check, XCircle, Gamepad2 } from 'lucide-react';
import { Game, GameData } from '@/types/game';
import { getMetacriticColor, getStatusColor } from '@/lib/utils';
import { mapRawgGame, RawgGame } from '@/lib/rawg';
import SteamRating from './SteamRating';

interface GameCardProps {
  game: Game;
  onClick: () => void;
  userGameData?: GameData;
  isAuthenticated?: boolean;
  index?: number;
  hideSteam?: boolean;
}

const statusIcon = {
  want: <Heart className="w-3 h-3" />,
  playing: <Gamepad className="w-3 h-3" />,
  completed: <Check className="w-3 h-3" />,
  dropped: <XCircle className="w-3 h-3" />,
  none: null,
};

const EAGER_LIMIT = 4;

export default function GameCard({
  game,
  onClick,
  userGameData,
  isAuthenticated = false,
  index = 0,
  hideSteam = false,
}: GameCardProps) {
  const showUserData = isAuthenticated && userGameData;
  const delay = Math.min(index * 40, 400);
  const isPriority = index < EAGER_LIMIT;

  // Локальные значения — дозаполняем, если пусто
  const [title, setTitle] = useState(game.title);
  const [cover, setCover] = useState(game.cover);
  const [fetching, setFetching] = useState(false);

  // Синхронизация, если пропс обновился
  useEffect(() => {
    setTitle(game.title);
    setCover(game.cover);
  }, [game.id, game.title, game.cover]);

  // Догрузка, если не хватает данных
  useEffect(() => {
    if (title && cover) return;
    if (!game.id) return;

    let cancelled = false;
    setFetching(true);

    fetch(`/api/games/${game.id}?full=true`)
      .then((r) => (r.ok ? r.json() : null))
      .then((raw: RawgGame | null) => {
        if (cancelled || !raw) return;
        const mapped = mapRawgGame(raw);
        if (mapped.title) setTitle(mapped.title);
        if (mapped.cover) setCover(mapped.cover);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFetching(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id]);

  const displayTitle = title || `Игра #${game.id}`;

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden hover:shadow-lg hover:border-neutral-700 transition-all duration-200 hover:-translate-y-1 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative aspect-video bg-neutral-800 overflow-hidden">
        {cover ? (
          <Image
            src={cover}
            alt={displayTitle}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            loading={isPriority ? 'eager' : 'lazy'}
            priority={isPriority}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-800">
            <Gamepad2 className="w-10 h-10 text-neutral-600" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          {game.metacritic && game.metacritic > 0 && (
            <div
              className={`${getMetacriticColor(game.metacritic)} px-2 py-1 rounded-lg flex items-center gap-1 shadow-lg`}
            >
              <span className="text-xs font-bold">{game.metacritic}</span>
              <span className="text-[9px] opacity-70">MC</span>
            </div>
          )}
          {!hideSteam && displayTitle && <SteamRating gameTitle={displayTitle} variant="badge" />}
        </div>

        {showUserData && showUserData.status !== 'none' && (
          <div
            className={`absolute top-2 left-2 ${getStatusColor(showUserData.status)} rounded-full p-1.5 shadow-lg`}
          >
            {statusIcon[showUserData.status]}
          </div>
        )}

        <div className="absolute bottom-2 left-2 right-2">
          <h3 className="font-semibold text-sm text-white line-clamp-1 drop-shadow-lg">
            {displayTitle}
          </h3>
        </div>
      </div>

      <div className="p-3 space-y-2">
        <div className="flex flex-wrap gap-1 min-h-[18px]">
          {game.genres?.slice(0, 3).map((g) => (
            <span
              key={g.id}
              className="text-[10px] text-neutral-400 bg-neutral-800 px-1.5 py-0.5 rounded"
            >
              {g.name}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>{game.year || ''}</span>
          <span className="truncate ml-2">
            {game.platforms?.slice(0, 2).join(', ') || ''}
          </span>
        </div>

        {showUserData && (showUserData.rating > 0 || showUserData.hours > 0) && (
          <div className="pt-2 border-t border-neutral-800 flex items-center gap-3 text-xs">
            {showUserData.rating > 0 && (
              <span className="flex items-center gap-1 text-yellow-400">
                <Star className="w-3 h-3 fill-yellow-400" />
                {showUserData.rating}
              </span>
            )}
            {showUserData.hours > 0 && (
              <span className="flex items-center gap-1 text-neutral-400">
                <Clock className="w-3 h-3" />
                {showUserData.hours}ч
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}