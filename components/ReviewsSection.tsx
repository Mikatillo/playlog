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
}

export default function ReviewsSection({
  gameId,
  title = 'Рецензии игроков',
  emptyText = 'Пока никто не оставил рецензию на эту игру',
  emptyHint = 'Стань первым — напиши свою рецензию выше',
}: ReviewsSectionProps) {
  const { userId } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [userVotes, setUserVotes] = useState<Record<string, 'like' | 'dislike'>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        const res = await fetch(`/api/reviews?game_id=${gameId}`);
        const data = await res.json();
        if (cancelled) return;
        setReviews(data.reviews || []);

        if (userId && data.reviews?.length > 0) {
          const ids = data.reviews.map((r: Review) => r.id).join(',');
          const votesRes = await fetch(`/api/reviews/vote?user_id=${userId}&review_ids=${ids}`);
          const votesData = await votesRes.json();
          if (!cancelled) setUserVotes(votesData.votes || {});
        }
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
  }, [gameId, userId]);

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