import { Clock, Star } from 'lucide-react';
import type { Game, GameData } from '@/types/game';

interface GameCardDetailsProps {
  game: Game;
  userData?: GameData;
  compact?: boolean;
}

/** Название и личная статистика в одной строке: наличие оценок не меняет высоту. */
export default function GameCardDetails({ game, userData, compact = false }: GameCardDetailsProps) {
  const hasRating = !!userData && userData.rating > 0;
  const hasHours = !!userData && userData.hours > 0;

  return (
    <div className={`flex min-w-0 items-center gap-2 ${compact ? 'px-2.5 py-2' : 'p-3'}`}>
      <h3
        title={game.title}
        className={`min-w-0 flex-1 truncate font-semibold leading-5 text-white ${compact ? 'text-xs' : 'text-sm'}`}
      >
        {game.title}
      </h3>
      {(hasRating || hasHours) && (
        <div className="flex shrink-0 items-center gap-2 text-[11px] leading-5 tabular-nums">
          {hasRating && (
            <span className="flex items-center gap-1 text-yellow-400" aria-label={`Моя оценка: ${userData!.rating}`}>
              <Star className="h-3 w-3 fill-yellow-400" aria-hidden="true" />
              {userData!.rating}
            </span>
          )}
          {hasHours && (
            <span className="flex items-center gap-1 text-neutral-400" aria-label={`Наиграно: ${userData!.hours} ч`}>
              <Clock className="h-3 w-3" aria-hidden="true" />
              {userData!.hours}ч
            </span>
          )}
        </div>
      )}
    </div>
  );
}
