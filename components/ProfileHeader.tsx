'use client';

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
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl backdrop-blur-md p-4 md:p-6">
            <div className="flex flex-col sm:flex-row gap-5 md:gap-6 sm:items-center">
        {/* Аватар — вертикальный прямоугольник, увеличенный */}
        <div className="relative flex-shrink-0 self-start sm:self-auto mx-auto sm:mx-0">
          <div className="relative w-40 h-52 sm:w-44 sm:h-60 md:w-52 md:h-72 rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center ring-2 ring-neutral-800">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.nickname}
                fill
                sizes="(max-width: 640px) 160px, 208px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <span className="text-5xl md:text-6xl font-bold text-white">{initials}</span>
            )}
          </div>

          {/* Уровень в углу аватара */}
          <div className="absolute -top-2 -right-2 min-w-[36px] h-9 px-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-neutral-900 flex items-center justify-center shadow-lg">
            <span className="text-white text-sm font-bold">{levelInfo.level}</span>
          </div>
        </div>

        {/* Информация */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-white truncate leading-tight">
                {profile.nickname}
              </h1>
              <div className="flex items-center gap-2 flex-wrap text-sm text-neutral-400 mt-1.5">
                <span>@{profile.nickname.toLowerCase()}</span>
                {(profile.city || profile.region) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {[profile.city, profile.region].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
            </div>

            {/* Кнопка-иконка редактирования */}
            {isOwnProfile && (
              <button
                onClick={onEdit}
                title="Редактировать профиль"
                className="flex-shrink-0 w-9 h-9 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 flex items-center justify-center transition"
              >
                <Pencil className="w-4 h-4 text-neutral-300" />
              </button>
            )}
          </div>

          {/* Цитата-статус */}
          {statusText && (
                <div className="mt-3 text-base text-white leading-snug max-w-2xl">
              «{statusText}»
            </div>
          )}

          {/* Бейджи + кнопки */}
          <div className="flex flex-wrap items-center gap-2 mt-auto pt-4">
            {followersCount > 0 && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-neutral-800/70 border border-neutral-700 text-neutral-400 text-xs">
                <ThumbsUp className="w-3.5 h-3.5" />
                {followersCount} {followersCount === 1 ? 'подписчик' : 'подписчиков'}
              </div>
            )}
            {profile.steam_url && (
              <a
                href={profile.steam_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-neutral-800/70 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs transition"
              >
                <img src="https://cdn.simpleicons.org/steam/66c0f4" alt="Steam" className="w-4 h-4" />
                Steam-профиль
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            {!isOwnProfile && (
              <button
                onClick={onToggleFollow}
                disabled={followLoading}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition disabled:opacity-50 ml-auto ${
                  isFollowing
                    ? 'bg-indigo-500 text-white hover:bg-indigo-600'
                    : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700 border border-neutral-700'
                }`}
              >
                <ThumbsUp className={`w-4 h-4 ${isFollowing ? 'fill-current' : ''}`} />
                {isFollowing ? 'Вы подписаны' : 'Подписаться'}
              </button>
            )}
          </div>

          {/* 4 метрики */}
          <div className="grid grid-cols-4 gap-3 mt-5 pt-5 border-t border-neutral-800">
            <div>
              <div className="text-xl md:text-2xl font-bold text-white leading-none">
                {profile.totalGames}
              </div>
              <div className="text-[11px] text-neutral-500 mt-1.5 uppercase tracking-wider">
                Игр
              </div>
            </div>
            <div>
              <div className="text-xl md:text-2xl font-bold text-white leading-none">
                {profile.completedGames}
              </div>
              <div className="text-[11px] text-neutral-500 mt-1.5 uppercase tracking-wider">
                Пройдено
              </div>
            </div>
            <div>
              <div className="text-xl md:text-2xl font-bold text-white leading-none">
                {profile.totalHours}
              </div>
              <div className="text-[11px] text-neutral-500 mt-1.5 uppercase tracking-wider">
                Часов
              </div>
            </div>
            <div>
              <div className="text-xl md:text-2xl font-bold text-white leading-none">
                {reviewsCount}
              </div>
              <div className="text-[11px] text-neutral-500 mt-1.5 uppercase tracking-wider">
                Рецензий
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}