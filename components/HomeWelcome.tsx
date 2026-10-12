'use client';

import Link from 'next/link';
import { Coins, Gamepad2, Trophy, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { calculateLevel } from '@/types/game';

export default function HomeWelcome() {
  const { userId, profile, userGames } = useAuth();
  if (!userId) return null;

  const lvl = calculateLevel(profile.xp || 0);
  const total = userGames.size;
  const completed = Array.from(userGames.values()).filter((d) => d.status === 'completed').length;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-r from-indigo-950/60 via-neutral-900 to-neutral-900 px-4 py-3 md:px-5 md:py-3.5">
      <div className="absolute -left-10 -top-10 w-40 h-40 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
      <div className="relative flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-48">
          <div className="text-sm md:text-base font-semibold text-white truncate">
            С возвращением{profile.nickname ? `, ${profile.nickname}` : ''}!
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[11px] font-bold text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-1.5 py-0.5 rounded-md">
              Ур. {lvl.level}
            </span>
            <div className="h-1.5 flex-1 max-w-[180px] bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-400"
                style={{ width: `${(lvl.xpInLevel / lvl.xpToNext) * 100}%` }}
              />
            </div>
            <span className="text-[11px] text-neutral-500">{lvl.xpInLevel}/{lvl.xpToNext} XP</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-neutral-300" title="Игр в библиотеке">
            <Gamepad2 className="w-4 h-4 text-indigo-400" />
            <b className="text-white">{total}</b>
          </span>
          <span className="flex items-center gap-1.5 text-neutral-300" title="Пройдено">
            <Trophy className="w-4 h-4 text-emerald-400" />
            <b className="text-white">{completed}</b>
          </span>
          <Link
            href="/shop"
            className="flex items-center gap-1.5 text-yellow-300 bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/20 px-2.5 py-1 rounded-lg transition"
            title="Магазин"
          >
            <Coins className="w-4 h-4" />
            <b>{profile.coins || 0}</b>
            <ShoppingBag className="w-3.5 h-3.5 opacity-70" />
          </Link>
        </div>
      </div>
    </div>
  );
}
