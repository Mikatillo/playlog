'use client';

import SteamIcon from '@/components/SteamIcon';
import { useEffect, useState } from 'react';
import {
  Pencil, MapPin, ThumbsUp, ExternalLink,
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

  const levelInfo = calculateLevel(profile.xp);
  const initials = profile.nickname.substring(0, 2).toUpperCase();

  return (
    <div className="bg-neutral-900/95 border border-neutral-800 rounded-2xl backdrop-blur-sm p-3 sm:p-4 md:p-6">
      {/* Верхний ряд: аватар + информация */}
      <div className="flex flex-row gap-3 sm:gap-5 md:gap-6 items-stretch">
        {/* Аватар */}
        <div className="relative flex-shrink-0 self-start">
          <div className="relative w-24 h-32 sm:w-32 sm:h-44 md:w-40 md:h-56 rounded-xl sm:rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center ring-2 ring-neutral-800">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.nickname}
                fill
                sizes="(max-width: 640px) 96px, (max-width: 768px) 128px, 160px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <span className="text-3xl sm:text-4xl md:text-5xl font-bold text-white">
                {initials}
              </span>
            )}
          </div>

          {/* Уровень в углу аватара */}
          <div className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 min-w-[28px] sm:min-w-[36px] h-7 sm:h-9 px-1.5 sm:px-2 rounded-lg sm:rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-neutral-900 flex items-center justify-center shadow-lg">
            <span className="text-white text-xs sm:text-sm font-bold">{levelInfo.level}</span>
          </div>
        </div>

        {/* Информация */}
        <div className="flex-1 min-w-0 flex flex-col relative">
          {/* Кнопка редактирования — правый верхний угол */}
          {isOwnProfile && (
            <button
              onClick={onEdit}
              title="Редактировать профиль"
              className="absolute top-0 right-0 w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 flex items-center justify-center transition z-10"
            >
              <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-300" />
            </button>
          )}

          {/* Ник + локация — по центру вертикали, с отступом справа, чтобы не заезжать под кнопку */}
          <div className="flex flex-col justify-center flex-1 pr-10 sm:pr-12 min-w-0">
            <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-white truncate leading-tight">
              {profile.nickname}
            </h1>
            <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm text-neutral-400 mt-1 sm:mt-1.5">
              <span>@{profile.nickname.toLowerCase()}</span>
              {(profile.city || profile.region) && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  {[profile.city, profile.region].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          </div>

          {/* Бейджи + кнопка подписки — снизу */}
          <div className="flex flex-wrap items-center gap-2 pt-3 sm:pt-4">
            {followersCount > 0 && (
              <div className="inline-flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-md bg-neutral-800/70 border border-neutral-700 text-neutral-400 text-[11px] sm:text-xs">
                <ThumbsUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                {followersCount} {followersCount === 1 ? 'подписчик' : 'подписчиков'}
              </div>
            )}
            {profile.steam_url && (
              <a
                href={profile.steam_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-md bg-neutral-800/70 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 text-[11px] sm:text-xs transition"
              >
                <SteamIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#66c0f4]" />
                Steam
                <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              </a>
            )}

            {!isOwnProfile && (
              <button
                onClick={onToggleFollow}
                disabled={followLoading}
                className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition disabled:opacity-50 ml-auto ${
                  isFollowing
                    ? 'bg-indigo-500 text-white hover:bg-indigo-600'
                    : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700 border border-neutral-700'
                }`}
              >
                <ThumbsUp className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isFollowing ? 'fill-current' : ''}`} />
                {isFollowing ? 'Вы подписаны' : 'Подписаться'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Цитата — на всю ширину под аватаром */}
      {statusText && (
        <div className="mt-4 text-sm sm:text-base text-white leading-snug">
          «{statusText}»
        </div>
      )}

      {/* 4 метрики */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3 mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-neutral-800">
        <div>
          <div className="text-base sm:text-xl md:text-2xl font-bold text-white leading-none">
            {profile.totalGames}
          </div>
          <div className="text-[9px] sm:text-[11px] text-neutral-500 mt-1 sm:mt-1.5 uppercase tracking-wider">
            Игр
          </div>
        </div>
        <div>
          <div className="text-base sm:text-xl md:text-2xl font-bold text-white leading-none">
            {profile.completedGames}
          </div>
          <div className="text-[9px] sm:text-[11px] text-neutral-500 mt-1 sm:mt-1.5 uppercase tracking-wider">
            Пройдено
          </div>
        </div>
        <div>
          <div className="text-base sm:text-xl md:text-2xl font-bold text-white leading-none">
            {profile.totalHours}
          </div>
          <div className="text-[9px] sm:text-[11px] text-neutral-500 mt-1 sm:mt-1.5 uppercase tracking-wider">
            Часов
          </div>
        </div>
        <div>
          <div className="text-base sm:text-xl md:text-2xl font-bold text-white leading-none">
            {reviewsCount}
          </div>
          <div className="text-[9px] sm:text-[11px] text-neutral-500 mt-1 sm:mt-1.5 uppercase tracking-wider">
            Рецензий
          </div>
        </div>
      </div>
    </div>
  );
}