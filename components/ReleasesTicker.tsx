'use client';

import { useEffect, useState } from 'react';
import { Calendar, Gamepad2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { mapRawgGame, RawgGame } from '@/lib/rawg';
import { Game } from '@/types/game';

function formatDate(iso?: string, year?: number): string {
  if (!iso && !year) return '';
  if (!iso) return String(year);
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  } catch {
    return String(year || '');
  }
}

export default function ReleasesTicker() {
  const [releases, setReleases] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/games/releases')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const mapped = (data.results || [])
          .map((g: RawgGame) => mapRawgGame(g))
          .filter((g: Game) => g.year > 0)
          .slice(0, 20);
        setReleases(mapped);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="hidden md:flex bg-neutral-900 rounded-xl border border-neutral-800 h-[104px] items-center px-5 gap-3 overflow-hidden">
        <div className="flex items-center gap-2 text-neutral-400 flex-shrink-0">
          <Calendar className="w-4 h-4" />
          <span className="text-sm font-medium">Релизы</span>
        </div>
        <div className="flex-1 flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-60 h-20 bg-neutral-800 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (releases.length === 0) return null;

  const doubled = [...releases, ...releases];

  return (
    <div className="hidden md:block bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden group">
      <div className="flex items-center">
        <Link
          href="/releases"
          className="flex items-center gap-2 px-5 py-4 border-r border-neutral-800 flex-shrink-0 bg-neutral-900 z-10 hover:bg-neutral-800 transition"
        >
          <Calendar className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-medium text-white whitespace-nowrap">Релизы</span>
        </Link>

        <div className="relative flex-1 overflow-hidden">
          <div className="flex gap-3 py-3 animate-marquee group-hover:[animation-play-state:paused]">
            {doubled.map((game, i) => (
              <Link
                key={`${game.id}-${i}`}
                href="/releases"
                className="flex-shrink-0 flex items-center gap-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg p-2 pr-4 transition w-64"
              >
                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0 ring-1 ring-neutral-700/50">
                  {game.cover ? (
                    <Image
                      src={game.cover}
                      alt={game.title}
                      fill
                      sizes="64px"
                      quality={95}
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Gamepad2 className="w-6 h-6 text-neutral-600" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white truncate">
                    {game.title}
                  </div>
                  <div className="text-xs text-indigo-400 font-medium mt-0.5">
                    {formatDate(game.released, game.year)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}