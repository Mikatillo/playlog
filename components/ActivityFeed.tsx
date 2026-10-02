'use client';

import { useEffect, useState } from 'react';
import { Loader2, Gamepad, Check, XCircle, Star, MessageSquare, Clock } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface Activity {
  id: string;
  user_id: string;
  type: 'added' | 'started' | 'completed' | 'dropped' | 'rated' | 'reviewed';
  game_id: number;
  game_title: string;
  game_cover: string | null;
  hours: number;
  rating: number | null;
  preview: string | null;
  created_at: string;
  nickname: string;
  avatar_url: string | null;
}

interface ActivityFeedProps {
  userId: string;
  scope?: 'user' | 'feed';
  showAvatars?: boolean;
  limit?: number;
  emptyText?: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} ч`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} дн`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} мес`;
  return `${Math.floor(months / 12)} г`;
}

function getActivityText(a: Activity): string {
  switch (a.type) {
    case 'added': return 'добавил(а)';
    case 'started': return 'начал(а) играть в';
    case 'completed': return 'прошёл(ла)';
    case 'dropped':
      return a.hours > 0 ? `забросил(а) после ${a.hours} ч. в` : 'забросил(а)';
    case 'rated': return a.rating ? `оценил(а) на ${a.rating}/10` : 'оценил(а)';
    case 'reviewed': return 'написал(а) рецензию на';
    default: return 'обновил(а)';
  }
}

function getActivityIcon(type: Activity['type']) {
  switch (type) {
    case 'completed': return <Check className="w-3.5 h-3.5" />;
    case 'dropped': return <XCircle className="w-3.5 h-3.5" />;
    case 'rated': return <Star className="w-3.5 h-3.5" />;
    case 'reviewed': return <MessageSquare className="w-3.5 h-3.5" />;
    default: return <Gamepad className="w-3.5 h-3.5" />;
  }
}

function getActivityColor(type: Activity['type']): string {
  switch (type) {
    case 'completed': return 'text-emerald-400 bg-emerald-500/15';
    case 'dropped': return 'text-neutral-400 bg-neutral-500/15';
    case 'rated': return 'text-yellow-400 bg-yellow-500/15';
    case 'reviewed': return 'text-indigo-400 bg-indigo-500/15';
    default: return 'text-blue-400 bg-blue-500/15';
  }
}

export default function ActivityFeed({
  userId,
  scope = 'user',
  showAvatars = false,
  limit = 10,
  emptyText = 'Пока нет активности',
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/activity?user_id=${userId}&scope=${scope}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setActivities((data.activities || []).slice(0, limit));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [userId, scope, limit]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-neutral-500">{emptyText}</div>
    );
  }

  return (
    <div className="space-y-2">
      {activities.map((a) => {
        const initials = a.nickname.substring(0, 2).toUpperCase();
        return (
          <div
            key={a.id}
            className="flex items-start gap-3 p-3 rounded-xl bg-neutral-900/50 border border-neutral-800 hover:border-neutral-700 transition"
          >
            {showAvatars && (
              <Link
                href={`/user/${a.user_id}`}
                className="flex-shrink-0 relative w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white"
              >
                {a.avatar_url ? (
                  <Image src={a.avatar_url} alt={a.nickname} fill sizes="36px" className="object-cover" unoptimized />
                ) : initials}
              </Link>
            )}

            <Link
              href={`/?open=${a.game_id}`}
              className="flex-shrink-0 relative w-10 h-14 rounded-lg overflow-hidden bg-neutral-800"
            >
              {a.game_cover ? (
                <Image src={a.game_cover} alt={a.game_title} fill sizes="40px" className="object-cover" unoptimized />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Gamepad className="w-4 h-4 text-neutral-600" />
                </div>
              )}
            </Link>

            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-1.5 flex-wrap">
                {showAvatars && (
                  <Link
                    href={`/user/${a.user_id}`}
                    className="text-sm font-medium text-white hover:text-indigo-400 transition"
                  >
                    {a.nickname}
                  </Link>
                )}
                <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${getActivityColor(a.type)}`}>
                  {getActivityIcon(a.type)}
                </span>
                <span className="text-sm text-neutral-400">{getActivityText(a)}</span>
                <Link
                  href={`/?open=${a.game_id}`}
                  className="text-sm font-medium text-white hover:text-indigo-400 transition truncate max-w-[200px]"
                >
                  {a.game_title}
                </Link>
              </div>

              {a.preview && (
                <div className="mt-1 text-xs text-neutral-500 italic line-clamp-1">
                  «{a.preview}»
                </div>
              )}

              <div className="text-[11px] text-neutral-500 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeAgo(a.created_at)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}