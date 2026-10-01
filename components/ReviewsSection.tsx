'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ReviewCard from './ReviewCard';

interface Review {
  id: string;
  user_id: string;
  game_id: number;
  rating: number | null;
  text: string;
  created_at: string;
  nickname: string;
  avatar_url: string | null;
  likes: number;
  dislikes: number;
  comments_count: number;
}

interface ReviewsSectionProps {
  gameId: number;
  title?: string;
  emptyText?: string;
  emptyHint?: string;
  refreshKey?: number;
}

// Глобальный кеш — живёт до перезагрузки страницы
const cache = new Map<
  string,
  {
    reviews: Review[];
    userVotes: Record<string, 'like' | 'dislike'>;
    ts: number;
  }
>();

const CACHE_TTL = 30_000; // 30 секунд
const FRESH_TTL = 5_000; // 5 секунд — можно вообще не ходить на сервер

export default function ReviewsSection({
  gameId,
  title = 'Рецензии игроков',
  emptyText = 'Пока никто не оставил рецензию на эту игру',
  emptyHint = 'Стань первым — напиши свою рецензию выше',
  refreshKey = 0,
}: ReviewsSectionProps) {
  const { userId } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [userVotes, setUserVotes] = useState<Record<string, 'like' | 'dislike'>>({});

  useEffect(() => {
    let cancelled = false;
    const cacheKey = `${gameId}:${userId || 'anon'}`;
    const cached = cache.get(cacheKey);

    // 1. Если есть кеш — показываем моментально
    if (cached) {
      setReviews(cached.reviews);
      setUserVotes(cached.userVotes);
      setLoading(false);

      // Если кеш свежий (5 сек) и не форсим обновление — не дёргаем сервер
      if (Date.now() - cached.ts < FRESH_TTL && refreshKey === 0) {
        return;
      }
    } else {
      setLoading(true);
    }

    // 2. Загружаем актуальные данные в фоне
    const load = async () => {
      try {
        const params = new URLSearchParams({ game_id: String(gameId) });
        if (userId) params.set('user_id', userId);

        const res = await fetch(`/api/reviews?${params.toString()}`, { cache: 'no-store' });
        const data = await res.json();

        if (cancelled) return;

        const reviewsData = data.reviews || [];
        const votesData = data.userVotes || {};

        setReviews(reviewsData);
        setUserVotes(votesData);

        // Обновляем кеш
        cache.set(cacheKey, {
          reviews: reviewsData,
          userVotes: votesData,
          ts: Date.now(),
        });
      } catch (err) {
        console.error('Reviews load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [gameId, userId, refreshKey]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-indigo-500" />
        <h3 className="font-semibold text-white text-sm md:text-base">{title}</h3>
        <span className="text-xs text-neutral-500">({reviews.length})</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
          <span className="ml-2 text-sm text-neutral-400">Загрузка...</span>
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-8 bg-neutral-900 border border-neutral-800 rounded-xl">
          <MessageSquare className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
          <p className="text-sm text-neutral-400">{emptyText}</p>
          <p className="text-xs text-neutral-500 mt-1">{emptyHint}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              userVote={userVotes[review.id] || null}
            />
          ))}
        </div>
      )}
    </div>
  );
}