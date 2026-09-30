'use client';

import { Star, Clock, Heart, Gamepad, Check } from 'lucide-react';
import { Game, GameData } from '@/types/game';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';

interface GameCardProps {
  game: Game;
  onClick: () => void;
  userGameData?: GameData;
}

export default function GameCard({ game, onClick, userGameData }: GameCardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAuthenticated(!!user);
    });
  }, []);

  const statusIcon = {
    want: <Heart className="w-3.5 h-3.5" />,
    playing: <Gamepad className="w-3.5 h-3.5" />,
    completed: <Check className="w-3.5 h-3.5" />,
    none: null,
  };

  const statusColor = {
    want: 'bg-rose-500',
    playing: 'bg-blue-500',
    completed: 'bg-emerald-500',
    none: '',
  };

  const statusLabel = {
    want: 'Хочу пройти',
    playing: 'В процессе',
    completed: 'Пройдена',
    none: '',
  };

  const showUserData = isAuthenticated && userGameData;

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden hover:shadow-lg hover:border-neutral-700 transition-all duration-200 hover:-translate-y-1"
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-neutral-800">
        <img
          src={game.cover}
          alt={game.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'https://via.placeholder.com/300x450/171717/525252?text=No+Image';
          }}
        />
        
        {/* Значок статуса в правом верхнем углу */}
        {showUserData && showUserData.status !== 'none' && (
          <div className={`absolute top-2 right-2 ${statusColor[showUserData.status]} rounded-full p-1.5 shadow-lg`}>
            {statusIcon[showUserData.status]}
          </div>
        )}

        {/* Подпись статуса внизу обложки */}
        {showUserData && showUserData.status !== 'none' && (
          <div className={`absolute bottom-0 left-0 right-0 ${statusColor[showUserData.status]} py-1.5 text-center`}>
            <span className="text-[10px] font-medium text-white uppercase tracking-wide">
              {statusLabel[showUserData.status]}
            </span>
          </div>
        )}

        {game.rating > 0 && (
          <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-md flex items-center gap-1">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span className="text-xs font-medium">{game.rating}</span>
          </div>
        )}
      </div>

      <div className="p-3">
        <h3 className="font-medium text-sm text-white line-clamp-1 mb-1 group-hover:text-indigo-400 transition">
          {game.title}
        </h3>
        
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>{game.year}</span>
          <span className="truncate ml-2">{game.genre}</span>
        </div>

        {showUserData && (
          <div className="mt-2 pt-2 border-t border-neutral-800 flex items-center gap-3 text-xs">
            {/* Оценка */}
            {showUserData.rating > 0 ? (
              <span className="flex items-center gap-1 text-yellow-400">
                <Star className="w-3 h-3 fill-yellow-400" />
                {showUserData.rating}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-neutral-600">
                <Star className="w-3 h-3" />
                Без оценки
              </span>
            )}

            {/* Часы */}
            {showUserData.hours > 0 && (
              <span className="flex items-center gap-1 text-neutral-400 ml-auto">
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