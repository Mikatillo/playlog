'use client';

import GameImage from '@/components/GameImage';
import { Heart, Gamepad, Check, XCircle } from 'lucide-react';
import GameCardDetails from './GameCardDetails';
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
    <button
      type="button"
      onClick={onClick}
      className="card-glow group relative w-full min-w-0 text-left cursor-pointer bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden animate-fade-in-up"
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
          className="object-cover"
          loading={isPriority ? 'eager' : 'lazy'}
          priority={isPriority}
        />

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
      </div>

      <GameCardDetails
        game={game}
        userData={showUserData || undefined}
        compact={compact}
      />
    </button>
  );
}
