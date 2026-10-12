'use client';

import { Compass, Crosshair, Brain, Puzzle, Car, Trophy, Gem, Swords, ArrowRight } from 'lucide-react';

interface GenreTilesProps {
  selected: string;
  onPick: (genreId: string) => void;
}

const TILES = [
  { id: 'action', name: 'Экшен', hint: 'Драйв и адреналин', icon: Swords, from: 'from-rose-600', to: 'to-orange-500' },
  { id: 'role-playing-games-rpg', name: 'RPG', hint: 'Миры и персонажи', icon: Gem, from: 'from-violet-600', to: 'to-fuchsia-500' },
  { id: 'adventure', name: 'Приключения', hint: 'Истории и открытия', icon: Compass, from: 'from-emerald-600', to: 'to-teal-400' },
  { id: 'shooter', name: 'Шутеры', hint: 'Точность и реакция', icon: Crosshair, from: 'from-sky-600', to: 'to-cyan-400' },
  { id: 'strategy', name: 'Стратегии', hint: 'Думай на ходы вперёд', icon: Brain, from: 'from-amber-600', to: 'to-yellow-400' },
  { id: 'puzzle', name: 'Головоломки', hint: 'Для ума', icon: Puzzle, from: 'from-pink-600', to: 'to-rose-400' },
  { id: 'racing', name: 'Гонки', hint: 'Скорость', icon: Car, from: 'from-blue-700', to: 'to-indigo-400' },
  { id: 'sports', name: 'Спорт', hint: 'Соревнуйся', icon: Trophy, from: 'from-lime-600', to: 'to-green-400' },
];

export default function GenreTiles({ selected, onPick }: GenreTilesProps) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg md:text-xl font-bold text-white">Во что хочется сыграть?</h2>
        <p className="text-xs md:text-sm text-neutral-500 mt-0.5">Выбери настроение — покажем подходящие игры в каталоге</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3">
        {TILES.map((t) => {
          const Icon = t.icon;
          const active = selected === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(active ? '' : t.id)}
              className={`group relative overflow-hidden rounded-2xl p-3.5 md:p-4 text-left h-[88px] md:h-[104px] bg-gradient-to-br ${t.from} ${t.to} transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] ${
                active ? 'ring-2 ring-white shadow-xl' : ''
              }`}
            >
              <Icon className="absolute -right-2 -bottom-3 w-20 h-20 md:w-24 md:h-24 text-white/20 group-hover:text-white/30 group-hover:scale-110 group-hover:-rotate-6 transition duration-500" />
              <div className="relative">
                <div className="text-sm md:text-base font-bold text-white drop-shadow">{t.name}</div>
                <div className="text-[11px] md:text-xs text-white/80 mt-0.5">{t.hint}</div>
              </div>
              <ArrowRight className="absolute left-3.5 bottom-3 w-4 h-4 text-white/0 group-hover:text-white/90 -translate-x-1 group-hover:translate-x-0 transition" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
