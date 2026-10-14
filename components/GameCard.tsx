'use client';

import GameImage from '@/components/GameImage';
import { Star, Clock, Heart, Gamepad, Check, XCircle } from 'lucide-react';
import { Game, GameData } from '@/types/game';
import { getMetacriticColor, getStatusColor } from '@/lib/utils';
import SteamRating from './SteamRating';

interface GameCardProps {
  game: Game;
  onClick: () => void;
  userGameData?: GameData;
  isAuthenticated?: boolean;
  index?: number;
  hideSteam?: boolean;
  /** Компактный вид: меньше текста, чтобы в ряд помещалось больше карточек */
  compact?: boolean;
}

const statusIcon = {
  want: <Heart className="w-3 h-3" />,
  playing: <Gamepad className="w-3 h-3" />,
  completed: <Check className="w-3 h-3" />,
  dropped: <XCircle className="w-3 h-3" />,
  none: null,
};

// Сколько карточек в сетке грузить сразу (выше первого экрана)
const EAGER_LIMIT = 4;

export default function GameCard({
  game,
  onClick,
  userGameData,
  isAuthenticated = false,
  index = 0,
  hideSteam = false,
  compact = false,
}: GameCardProps) {
  const showUserData = isAuthenticated && userGameData;
  const delay = Math.min(index * 40, 400);
  const isPriority = index < EAGER_LIMIT;

  return (
    <div
      onClick={onClick}
      className="card-glow group cursor-pointer bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative aspect-[460/215] bg-neutral-800 overflow-hidden">
        <GameImage
          src={game.cover || 'https://via.placeholder.com/400x225/171717/525252?text=No+Image'}
          fallback={game.coverAlt}
          smart
          alt={game.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          loading={isPriority ? 'eager' : 'lazy'}
          priority={isPriority}
        />

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
          {!hideSteam && !compact && <SteamRating gameTitle={game.title} variant="badge" />}
        </div>

        {showUserData && showUserData.status !== 'none' && (
          <div
            className={`absolute top-2 left-2 ${getStatusColor(showUserData.status)} rounded-full p-1.5 shadow-lg`}
          >
            {statusIcon[showUserData.status]}
          </div>
        )}

        <div className="absolute bottom-2 left-2 right-2">
          <h3 className={`font-semibold text-white line-clamp-1 drop-shadow-lg ${compact ? 'text-xs' : 'text-sm'}`}>
            {game.title}
          </h3>
        </div>
      </div>

      {compact && showUserData && (showUserData.rating > 0 || showUserData.hours > 0) ? (
        // Компактный вид: слева жанр и год, справа за вертикальной чертой — оценка и часы
        <div className="px-2.5 py-2 flex items-stretch gap-2.5">
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
            <div className="flex gap-1 max-h-[18px] overflow-hidden">
              {game.genres?.slice(0, 1).map((g) => (
                <span key={g.id} className="text-[10px] text-neutral-400 bg-neutral-800 px-1.5 py-0.5 rounded truncate">
                  {g.name}
                </span>
              ))}
            </div>
            <span className="text-xs text-neutral-500">{game.year}</span>
          </div>
          <div className="w-px bg-neutral-800 self-stretch" />
          <div className="flex flex-col justify-center gap-1 text-xs min-w-[44px]">
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
        </div>
      ) : (
      <div className={compact ? 'px-2.5 py-2 space-y-1.5' : 'p-3 space-y-2'}>
        <div className={`flex flex-wrap gap-1 ${compact ? 'max-h-[18px] overflow-hidden' : ''}`}>
          {game.genres?.slice(0, compact ? 1 : 3).map((g) => (
            <span
              key={g.id}
              className="text-[10px] text-neutral-400 bg-neutral-800 px-1.5 py-0.5 rounded"
            >
              {g.name}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>{game.year}</span>
          {!compact && (
            <span className="truncate ml-2">
              {game.platforms?.slice(0, 2).join(', ') || 'PC'}
            </span>
          )}
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
      )}
    </div>
  );
}