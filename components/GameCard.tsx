'use client';

import { Star, Clock } from 'lucide-react';
import { Game, GameData } from '@/types/game';
import { useState } from 'react';

interface GameCardProps {
  game: Game;
  onClick: () => void;
  userGameData?: GameData;
}

export default function GameCard({ game, onClick, userGameData }: GameCardProps) {
  const [showTrailer, setShowTrailer] = useState(false);

  return (
    <div
      onClick={onClick}
      className="group bg-[#1a1a2e] border-2 border-[#747474] hover:border-[#ffec27] cursor-pointer relative"
    >
      <div className="aspect-[2/3] bg-[#0f0f1e] relative overflow-hidden">
        <img
          src={game.cover}
          alt={game.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300x400/1a1a2e/747474?text=NO+IMAGE';
          }}
        />
        
        <div className="absolute top-2 right-2 bg-[#0f0f1e] border-2 border-[#ffec27] px-2 py-0.5 font-pixel text-[8px] flex items-center gap-1">
          <Star className="w-2 h-2 text-[#ffec27] fill-[#ffec27]" /> {game.rating}
        </div>
        <div className="absolute top-2 left-2 bg-[#b142f5] px-2 py-0.5 font-pixel text-[8px]">
          {game.genre}
        </div>

        {/* Превью трейлера при наведении */}
        {game.trailerUrl && (
          <div
            onMouseEnter={() => setShowTrailer(true)}
            onMouseLeave={() => setShowTrailer(false)}
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/90 flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {showTrailer ? (
              <iframe
                src={`${game.trailerUrl}?autoplay=1&mute=1`}
                className="w-full h-full"
                allow="autoplay"
                title="Trailer"
              />
            ) : (
              <div className="font-pixel text-[10px] text-[#ffec27]">▶ ТРЕЙЛЕР</div>
            )}
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-pixel text-[9px] truncate mb-2 text-[#fcfcfc] group-hover:text-[#ffec27]">
          {game.title.toUpperCase()}
        </h3>
        <div className="flex justify-between items-center">
          <div className="flex gap-1 flex-wrap">
            {game.platforms.slice(0, 3).map((p) => (
              <span key={p} className="font-pixel text-[7px] text-[#29adff]">{p}</span>
            ))}
          </div>
          <span className="font-pixel text-[8px] text-[#747474] flex items-center gap-1">
            <Clock className="w-2 h-2" /> {game.hours}h
          </span>
        </div>
      </div>
    </div>
  );
}