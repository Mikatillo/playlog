'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Flame, Play, Users } from 'lucide-react';
import type { Game } from '@/types/game';
import { rawgResize } from '@/lib/rawg';
import { fetchSteamTop, type SteamTopItem } from '@/lib/steam-client';
import SteamIcon from '@/components/SteamIcon';

interface SteamHeroProps {
  onGameClick: (game: Game) => void;
}

const SLIDE_MS = 8000;
const LIST_SIZE = 6;

function formatPlayers(n: number): string {
  if (!n) return '';
  return n.toLocaleString('ru-RU');
}

// В списке игры храним уменьшенную обложку, для героя берём крупную
function heroImage(cover: string): string {
  return rawgResize(cover.replace('/media/resize/640/-/', '/media/'), 1280);
}

export default function SteamHero({ onGameClick }: SteamHeroProps) {
  const [items, setItems] = useState<SteamTopItem[] | null>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSteamTop().then((list) => {
      if (!cancelled) setItems(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = (items || []).slice(0, LIST_SIZE);

  // Автопереключение героя
  useEffect(() => {
    if (paused || shown.length < 2) return;
    const t = setTimeout(() => setActive((i) => (i + 1) % shown.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [active, paused, shown.length]);

  if (items === null) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_340px] gap-3 md:gap-4">
        <div className="h-[260px] md:h-[380px] rounded-3xl bg-neutral-900 border border-neutral-800 animate-pulse" />
        <div className="hidden lg:block h-[380px] rounded-3xl bg-neutral-900 border border-neutral-800 animate-pulse" />
      </div>
    );
  }
  if (shown.length === 0) return null;

  const current = shown[Math.min(active, shown.length - 1)];
  const g = current.game;

  return (
    <section
      className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_340px] gap-3 md:gap-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Большой баннер */}
      <div className="relative min-w-0 h-[240px] sm:h-[330px] md:h-[380px] rounded-2xl md:rounded-3xl overflow-hidden border border-neutral-800 bg-neutral-900 group">
        <div key={g.id} className="absolute inset-0 hero-fade">
          <Image
            src={heroImage(g.cover)}
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 900px"
            className="object-cover"
            unoptimized
            priority
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/80 via-transparent to-transparent" />

        <div className="absolute top-3 left-3 md:top-4 md:left-4 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] md:text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-rose-500 px-3 py-1 rounded-full shadow-lg shadow-orange-500/30">
            <Flame className="w-3.5 h-3.5" />
            #{current.rank} новинка Steam
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-neutral-200 bg-black/50 backdrop-blur px-2.5 py-1 rounded-full">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full w-2 h-2 bg-emerald-400" />
            </span>
            обновляется вместе со Steam
          </span>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-3.5 pr-4 md:p-7">
          <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold text-white leading-tight drop-shadow-lg line-clamp-2">
            {g.title}
          </h1>
          <div className="mt-1.5 md:mt-2 flex flex-wrap items-center gap-x-3 md:gap-x-4 gap-y-1 text-xs md:text-sm text-neutral-200">
            {current.players > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-400" />
                {formatPlayers(current.players)} в пике за сутки
              </span>
            )}
            {g.year > 0 && <span className="text-neutral-400">{g.year}</span>}
            {g.genres?.slice(0, 2).map((x) => (
              <span key={x.id} className="text-[11px] bg-white/10 backdrop-blur px-2 py-0.5 rounded-md">
                {x.name}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onGameClick(g)}
            className="mt-3 md:mt-4 inline-flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 rounded-xl bg-white text-neutral-900 text-sm font-bold hover:bg-indigo-100 active:scale-95 transition shadow-lg"
          >
            <Play className="w-4 h-4 fill-current" />
            Открыть карточку
          </button>
        </div>

        {/* Индикатор слайдов */}
        <div className="absolute bottom-3 right-4 hidden md:flex items-center gap-1.5">
          {shown.map((s, i) => (
            <button
              key={s.game.id}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Показать ${s.game.title}`}
              className={`h-1.5 rounded-full transition-all ${i === active ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'}`}
            />
          ))}
        </div>
      </div>

      {/* Топ Steam: список */}
      <div className="min-w-0 rounded-2xl md:rounded-3xl bg-neutral-900/80 border border-neutral-800 p-3 md:p-4 flex flex-col">
        <div className="flex items-center gap-2 px-1 pb-3">
          <span className="w-7 h-7 rounded-lg bg-sky-500/15 flex items-center justify-center">
            <SteamIcon className="w-4 h-4 text-sky-300" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white leading-tight">Популярные новинки</div>
            <div className="text-[11px] text-neutral-500">что сейчас играют и покупают в Steam</div>
          </div>
        </div>

        <ol className="flex-1 flex flex-row lg:flex-col gap-2 lg:gap-1 overflow-x-auto lg:overflow-visible no-scrollbar -mx-1 px-1 snap-x">
          {shown.map((s, i) => {
            const isActive = i === active;
            return (
              <li key={s.game.id} className="snap-start flex-shrink-0 lg:flex-shrink w-[176px] sm:w-[210px] lg:w-auto">
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => onGameClick(s.game)}
                  className={`relative w-full flex items-center gap-3 rounded-xl p-2 text-left overflow-hidden transition ${
                    isActive ? 'bg-neutral-800' : 'hover:bg-neutral-800/60'
                  }`}
                >
                  <span className={`w-5 text-center text-sm font-extrabold ${i === 0 ? 'text-amber-400' : 'text-neutral-500'}`}>
                    {s.rank}
                  </span>
                  <span className="relative w-12 h-7 sm:w-14 sm:h-8 rounded-md overflow-hidden bg-neutral-800 flex-shrink-0">
                    <Image src={s.game.cover} alt="" fill sizes="56px" className="object-cover" unoptimized />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs sm:text-sm font-medium text-white truncate">{s.game.title}</span>
                    {s.players > 0 && (
                      <span className="block text-[11px] text-emerald-400/90">{formatPlayers(s.players)}</span>
                    )}
                  </span>
                  {isActive && !paused && shown.length > 1 && (
                    <span
                      key={`${active}-bar`}
                      className="absolute left-0 bottom-0 h-0.5 w-full bg-indigo-400 origin-left"
                      style={{ animation: `heroProgress ${SLIDE_MS}ms linear forwards` }}
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
