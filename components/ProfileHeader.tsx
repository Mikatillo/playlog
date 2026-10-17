'use client';

import SteamIcon from '@/components/SteamIcon';
import { useEffect, useState } from 'react';
import {
  Pencil, MapPin, ExternalLink, UserPlus, UserCheck, Quote,
  Gamepad2, Trophy, Clock, MessageSquare, ThumbsUp, Users,
} from 'lucide-react';
import Image from 'next/image';
import { calculateLevel } from '@/types/game';

interface ProfileHeaderProps {
  profile: {
    id: string;
    nickname: string;
    full_name: string;
    avatar_url: string | null;
    banner_url: string | null;
    banner_gradient: string;
    region: string;
    city: string;
    steam_url: string;
    xp: number;
    totalGames: number;
    completedGames: number;
    totalHours: number;
    coins?: number;
    activeStatusId?: string | null;
    activeBackgroundId?: string | null;
    activeBannerId?: string | null;
  };
  isOwnProfile: boolean;
  isFollowing: boolean;
  followersCount: number;
  followLoading: boolean;
  onToggleFollow: () => void;
  onEdit: () => void;
  reviewsCount: number;
  onOpenXpDetails?: () => void;
}

// Цвета баннера, если у профиля нет своей картинки и аватара
const BANNER_GRADIENTS: Record<string, string> = {
  indigo: 'from-indigo-600 via-violet-600 to-fuchsia-600',
  purple: 'from-purple-700 via-fuchsia-600 to-pink-500',
  emerald: 'from-emerald-600 via-teal-600 to-cyan-600',
  rose: 'from-rose-600 via-pink-600 to-orange-500',
  sky: 'from-sky-600 via-blue-600 to-indigo-600',
  amber: 'from-amber-500 via-orange-500 to-rose-500',
};

// Звание по уровню
function rankTitle(level: number): { title: string; className: string } {
  if (level >= 50) return { title: 'Легенда', className: 'text-amber-200 bg-amber-400/15 border-amber-300/30' };
  if (level >= 30) return { title: 'Мастер', className: 'text-fuchsia-200 bg-fuchsia-400/15 border-fuchsia-300/30' };
  if (level >= 15) return { title: 'Ветеран', className: 'text-sky-200 bg-sky-400/15 border-sky-300/30' };
  if (level >= 5) return { title: 'Игрок', className: 'text-emerald-200 bg-emerald-400/15 border-emerald-300/30' };
  return { title: 'Новичок', className: 'text-neutral-200 bg-white/10 border-white/20' };
}

// Склонение: 1 подписчик, 2–4 подписчика, 5+ подписчиков
function pluralFollowers(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'подписчик';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'подписчика';
  return 'подписчиков';
}

export default function ProfileHeader({
  profile,
  isOwnProfile,
  isFollowing,
  followersCount,
  followLoading,
  onToggleFollow,
  onEdit,
  reviewsCount,
}: ProfileHeaderProps) {
  const [statusText, setStatusText] = useState<string | null>(null);

  useEffect(() => {
    if (!profile.activeStatusId) {
      setStatusText(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/shop?ids=${profile.activeStatusId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const item = (data.items || [])[0];
        if (item) setStatusText(item.value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [profile.activeStatusId]);

  // Шапка из магазина (имеет приоритет над banner_url)
  const [shopBanner, setShopBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!profile.activeBannerId) {
      setShopBanner(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/shop?ids=${profile.activeBannerId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const item = (data.items || [])[0];
        setShopBanner(item?.value || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [profile.activeBannerId]);

  const levelInfo = calculateLevel(profile.xp);
  const rank = rankTitle(levelInfo.level);
  const initials = profile.nickname.substring(0, 2).toUpperCase();
  const xpPercent = Math.round((levelInfo.xpInLevel / levelInfo.xpToNext) * 100);
  const completionPercent =
    profile.totalGames > 0 ? Math.round((profile.completedGames / profile.totalGames) * 100) : 0;
  const gradient = BANNER_GRADIENTS[profile.banner_gradient] || BANNER_GRADIENTS.indigo;
  const location = [profile.city, profile.region].filter(Boolean).join(', ');

  const stats = [
    { icon: Gamepad2, value: profile.totalGames.toLocaleString('ru-RU'), label: 'Игр', hint: 'в коллекции', tint: 'text-indigo-300 bg-indigo-500/15', glow: '99,102,241' },
    { icon: Trophy, value: profile.completedGames.toLocaleString('ru-RU'), label: 'Пройдено', hint: `${completionPercent}% библиотеки`, tint: 'text-emerald-300 bg-emerald-500/15', glow: '16,185,129' },
    { icon: Clock, value: profile.totalHours.toLocaleString('ru-RU'), label: 'Часов', hint: 'в играх', tint: 'text-sky-300 bg-sky-500/15', glow: '14,165,233' },
    { icon: MessageSquare, value: reviewsCount.toLocaleString('ru-RU'), label: 'Рецензий', hint: 'опубликовано', tint: 'text-amber-300 bg-amber-500/15', glow: '245,158,11' },
  ];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900/90 backdrop-blur-md shadow-2xl shadow-black/40">
      {/* ===== Баннер ===== */}
      <div className="relative h-32 sm:h-44 md:h-52 overflow-hidden">
        {shopBanner ? (
          <div
            className="absolute inset-0"
            style={
              shopBanner.startsWith('http')
                ? { backgroundImage: `url(${shopBanner})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : { backgroundImage: shopBanner }
            }
          />
        ) : profile.banner_url ? (
          <Image
            src={profile.banner_url}
            alt=""
            fill
            sizes="(max-width: 1152px) 100vw, 1152px"
            className="object-cover"
            unoptimized
            priority
          />
        ) : (
          <>
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
            {profile.avatar_url && (
              // Размытая копия аватара: у каждого профиля баннер получается своим
              <Image
                src={profile.avatar_url}
                alt=""
                fill
                sizes="(max-width: 1152px) 100vw, 1152px"
                className="object-cover scale-150 blur-2xl saturate-150 opacity-90"
                unoptimized
              />
            )}
          </>
        )}

        {/* Свечение и сетка поверх баннера */}
        <div className="absolute inset-0 bg-[radial-gradient(60%_90%_at_85%_0%,rgba(255,255,255,0.22),transparent_70%)]" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            maskImage: 'linear-gradient(to bottom, black, transparent 90%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black, transparent 90%)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/30 to-black/10" />

        {/* Редактирование */}
        {isOwnProfile && (
          <button
            onClick={onEdit}
            title="Редактировать профиль"
            aria-label="Редактировать профиль"
            className="absolute top-3 right-3 sm:top-4 sm:right-4 inline-flex items-center gap-2 h-9 px-3 rounded-xl bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/15 hover:border-white/30 text-white text-xs font-medium transition hover:-translate-y-0.5 z-10"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Редактировать</span>
          </button>
        )}
      </div>

      {/* ===== Основной блок ===== */}
      <div className="relative px-4 sm:px-6 md:px-8 pb-5 sm:pb-7">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 -mt-14 sm:-mt-20 md:-mt-24">
          {/* На телефоне: аватар слева, справа — подписчики, Steam и XP (на ПК этот ряд «растворяется») */}
          <div className="flex items-end gap-4 sm:contents">
          {/* Аватар с уровнем */}
          <div className="relative flex-shrink-0 self-start group">
            <div className="absolute -inset-1 rounded-[1.75rem] bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-amber-400 opacity-70 blur-md group-hover:opacity-100 transition" />
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center ring-4 ring-neutral-900">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.nickname}
                  fill
                  sizes="(max-width: 640px) 112px, (max-width: 768px) 144px, 176px"
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                  unoptimized
                />
              ) : (
                <span className="text-4xl md:text-5xl font-bold text-white">{initials}</span>
              )}
            </div>

            <div
              className="absolute -bottom-2 -right-2 min-w-[46px] h-12 px-2 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 border-[3px] border-neutral-900 flex flex-col items-center justify-center shadow-lg shadow-indigo-500/40"
              title={`Уровень ${levelInfo.level}`}
            >
              <span className="text-[8px] font-semibold uppercase tracking-widest text-indigo-100/80 leading-none">Ур.</span>
              <span className="text-lg font-extrabold text-white leading-none mt-0.5">{levelInfo.level}</span>
            </div>
          </div>


          {/* Телефон: справа от аватара */}
          <div className="sm:hidden flex-1 min-w-0 pb-2 flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-neutral-800/70 border border-neutral-700/80 text-sm" title="Подписчики">
                <ThumbsUp className="w-4 h-4 text-indigo-300" />
                <b className="text-white">{followersCount}</b>
              </div>
              {profile.steam_url && (
                <a
                  href={profile.steam_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-neutral-800/70 border border-neutral-700/80 text-neutral-200 text-sm"
                >
                  <SteamIcon className="w-4 h-4 text-[#66c0f4]" />
                  Steam
                  <ExternalLink className="w-3 h-3 text-neutral-500" />
                </a>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1.5">
                <span>До ур. {levelInfo.level + 1}</span>
                <span className="text-neutral-300 font-medium">
                  {levelInfo.xpInLevel} / {levelInfo.xpToNext} XP
                </span>
              </div>
              <div className="h-2 rounded-full bg-neutral-800 overflow-hidden ring-1 ring-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-400"
                  style={{ width: `${Math.max(xpPercent, levelInfo.xpInLevel > 0 ? 3 : 0)}%` }}
                />
              </div>
            </div>
          </div>
          </div>

          {/* Имя, звание и прогресс */}
          <div className="flex-1 min-w-0 sm:pb-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white truncate leading-tight max-w-full">
                {profile.nickname}
              </h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-semibold uppercase tracking-wider ${rank.className}`}>
                {rank.title}
              </span>
            </div>

            <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-sm text-neutral-400 mt-1">
              <span>@{profile.nickname.toLowerCase()}</span>
              {location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {location}
                </span>
              )}
            </div>

            {/* Прогресс до следующего уровня */}
            <div className="mt-3 max-w-md hidden sm:block">
              <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1.5">
                <span>До уровня {levelInfo.level + 1}</span>
                <span className="text-neutral-300 font-medium">
                  {levelInfo.xpInLevel} / {levelInfo.xpToNext} XP
                </span>
              </div>
              <div className="h-2 rounded-full bg-neutral-800 overflow-hidden ring-1 ring-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-400 transition-all duration-700"
                  style={{ width: `${Math.max(xpPercent, levelInfo.xpInLevel > 0 ? 3 : 0)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Ссылки и действия */}
        <div className={`${isOwnProfile ? 'hidden sm:flex' : 'flex'} flex-wrap items-center gap-2 mt-5`}>
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800/70 border border-neutral-700/80 text-neutral-300 text-sm">
            <Users className="w-4 h-4 text-indigo-300" />
            <b className="text-white">{followersCount}</b> {pluralFollowers(followersCount)}
          </div>

          {profile.steam_url && (
            <a
              href={profile.steam_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800/70 hover:bg-[#1b6ca8]/30 border border-neutral-700/80 hover:border-[#66c0f4]/50 text-neutral-200 text-xs sm:text-sm transition hover:-translate-y-0.5"
            >
              <SteamIcon className="w-4 h-4 text-[#66c0f4]" />
              Steam
              <ExternalLink className="w-3 h-3 text-neutral-500" />
            </a>
          )}

          {!isOwnProfile && (
            <button
              onClick={onToggleFollow}
              disabled={followLoading}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50 ml-auto hover:-translate-y-0.5 ${
                isFollowing
                  ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-500/30'
                  : 'bg-white text-neutral-900 hover:bg-neutral-200'
              }`}
            >
              {isFollowing ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {isFollowing ? 'Вы подписаны' : 'Подписаться'}
            </button>
          )}
        </div>

        {/* Цитата-статус */}
        {statusText && (
          <blockquote className="relative mt-5 rounded-2xl border border-white/5 bg-gradient-to-r from-indigo-500/10 via-neutral-800/40 to-transparent pl-5 pr-4 py-3.5 overflow-hidden">
            <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-400 to-fuchsia-500" />
            <Quote className="absolute right-3 top-2 w-8 h-8 text-white/5 rotate-180" />
            <p className="relative text-sm sm:text-base text-neutral-100 italic leading-relaxed">
              «{statusText}»
            </p>
          </blockquote>
        )}

        {/* Метрики */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-5">
          {stats.map(({ icon: Icon, value, label, hint, tint, glow }) => (
            <div
              key={label}
              className="group relative overflow-hidden rounded-2xl bg-neutral-800/50 border border-neutral-800 hover:border-neutral-600 hover:bg-neutral-800 p-3 sm:p-4 transition hover:-translate-y-1"
            >
              {/* Цветное свечение из левого верхнего угла, к правому нижнему угасает до полной прозрачности */}
              <div
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `linear-gradient(135deg, rgba(${glow},0.22) 0%, rgba(${glow},0.09) 40%, rgba(${glow},0) 100%)`,
                }}
              />
              <div className="relative flex items-center gap-2.5">
                <span className={`w-9 h-9 rounded-xl inline-flex items-center justify-center flex-shrink-0 transition group-hover:scale-110 ${tint}`}>
                  <Icon className="w-[18px] h-[18px]" />
                </span>
                <div className="min-w-0">
                  <div className="text-xl sm:text-2xl font-extrabold text-white leading-none">{value}</div>
                  <div className="text-[10px] sm:text-[11px] text-neutral-500 mt-1 uppercase tracking-wider truncate">{label}</div>
                </div>
              </div>
              <div className="relative text-[11px] text-neutral-500 mt-2.5 pt-2.5 border-t border-neutral-800 truncate">{hint}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
