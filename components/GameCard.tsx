'use client';

import { Star, Clock, Heart, Gamepad, Check, XCircle } from 'lucide-react';
import { Game, GameData } from '@/types/game';

interface GameCardProps {
  game: Game;
  onClick: () => void;
  userGameData?: GameData;
  isAuthenticated?: boolean;
}

function getMetacriticColor(score: number): string {
  if (score >= 75) return 'bg-emerald-500/90 text-white';
  if (score >= 50) return 'bg-yellow-500/90 text-black';
  if (score >= 25) return 'bg-orange-500/90 text-white';
  return 'bg-red-500/90 text-white';
}

export default function GameCard({
  game,
  onClick,
  userGameData,
  isAuthenticated = false,
}: GameCardProps) {
  const statusIcon = {
    want: <Heart className="w-3 h-3" />,
    playing: <Gamepad className="w-3 h-3" />,
    completed: <Check className="w-3 h-3" />,
    dropped: <XCircle className="w-3 h-3" />,
    none: null,
  };

  const statusColor = {
    want: 'bg-rose-500',
    playing: 'bg-blue-500',
    completed: 'bg-emerald-500',
    dropped: 'bg-neutral-500',
    none: '',
  };

  const showUserData = isAuthenticated && userGameData;

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden hover:shadow-lg hover:border-neutral-700 transition-all duration-200 hover:-translate-y-1"
    >
      <div className="relative aspect-video bg-neutral-800 overflow-hidden">
        <img
          src={game.cover}
          alt={game.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'https://via.placeholder.com/400x225/171717/525252?text=No+Image';
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        {game.metacritic && game.metacritic > 0 && (
          <div
            className={`absolute top-2 right-2 ${getMetacriticColor(game.metacritic)} px-2 py-1 rounded-lg flex items-center gap-1 shadow-lg`}
          >
            <span className="text-xs font-bold">{game.metacritic}</span>
            <span className="text-[9px] opacity-70">MC</span>
          </div>
        )}

        {showUserData && showUserData.status !== 'none' && (
          <div
            className={`absolute top-2 left-2 ${statusColor[showUserData.status]} rounded-full p-1.5 shadow-lg`}
          >
            {statusIcon[showUserData.status]}
          </div>
        )}

        <div className="absolute bottom-2 left-2 right-2">
          <h3 className="font-semibold text-sm text-white line-clamp-1 drop-shadow-lg">
            {game.title}
          </h3>
        </div>
      </div>

      <div className="p-3 space-y-2">
        <div className="flex flex-wrap gap-1">
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
          <span>{game.year}</span>
          <span className="truncate ml-2">
            {game.platforms?.slice(0, 2).join(', ') || 'PC'}
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