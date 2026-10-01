'use client';

import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare, Send, Trash2, Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

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

interface Comment {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
  nickname: string;
  avatar_url: string | null;
}

interface ReviewCardProps {
  review: Review;
  userVote?: 'like' | 'dislike' | null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} дн назад`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} мес назад`;
  return `${Math.floor(months / 12)} г назад`;
}

export default function ReviewCard({ review, userVote: initialVote }: ReviewCardProps) {
  const { userId } = useAuth();
  const [likes, setLikes] = useState(review.likes);
  const [dislikes, setDislikes] = useState(review.dislikes);
  const [vote, setVote] = useState<'like' | 'dislike' | null>(initialVote || null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsCount, setCommentsCount] = useState(review.comments_count);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);

  const initials = review.nickname.substring(0, 2).toUpperCase();

  const handleVote = async (newVote: 'like' | 'dislike') => {
    if (!userId) return;

    const oldVote = vote;
    let newLikes = likes;
    let newDislikes = dislikes;

    // Оптимистичное обновление
    if (oldVote === newVote) {
      // Toggle off
      if (newVote === 'like') newLikes = Math.max(0, likes - 1);
      else newDislikes = Math.max(0, dislikes - 1);
      setVote(null);
    } else {
      // Снимаем старый, ставим новый
      if (oldVote === 'like') newLikes = Math.max(0, likes - 1);
      if (oldVote === 'dislike') newDislikes = Math.max(0, dislikes - 1);
      if (newVote === 'like') newLikes += 1;
      else newDislikes += 1;
      setVote(newVote);
    }

    setLikes(newLikes);
    setDislikes(newDislikes);

    try {
      await fetch('/api/reviews/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reviewId: review.id, vote: newVote }),
      });
    } catch {
      // Откат при ошибке
      setLikes(review.likes);
      setDislikes(review.dislikes);
      setVote(oldVote);
    }
  };

  const loadComments = async () => {
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/reviews/comments?review_id=${review.id}`);
      const data = await res.json();
      setComments(data.comments || []);
    } catch {
      setComments([]);
    }
    setCommentsLoading(false);
  };

  const toggleComments = () => {
    if (!commentsOpen && comments.length === 0) {
      loadComments();
    }
    setCommentsOpen((v) => !v);
  };

  const postComment = async () => {
    if (!userId || !commentText.trim()) return;
    setPosting(true);
    try {
      const res = await fetch('/api/reviews/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          reviewId: review.id,
          text: commentText.trim(),
        }),
      });
      if (res.ok) {
        setCommentText('');
        setCommentsCount((c) => c + 1);
        await loadComments();
      }
    } catch {}
    setPosting(false);
  };

  const deleteComment = async (commentId: string) => {
    if (!userId) return;
    await fetch(`/api/reviews/comments?id=${commentId}&user_id=${userId}`, {
      method: 'DELETE',
    });
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    setCommentsCount((c) => Math.max(0, c - 1));
  };

  return (
    <div className="bg-neutral-800/50 border border-neutral-800 rounded-xl p-3 md:p-4">
      {/* Шапка: автор */}
      <div className="flex items-start gap-3 mb-3">
        <Link href={`/user/${review.user_id}`} className="flex-shrink-0">
          <div className="relative w-9 h-9 md:w-10 md:h-10 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-white text-xs md:text-sm hover:opacity-80 transition">
            {review.avatar_url ? (
              <Image
                src={review.avatar_url}
                alt={review.nickname}
                fill
                sizes="40px"
                className="object-cover"
                unoptimized
              />
            ) : (
              initials
            )}
          </div>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/user/${review.user_id}`}
              className="text-sm font-medium text-white hover:text-indigo-400 transition truncate"
            >
              {review.nickname}
            </Link>
            {review.rating !== null && review.rating > 0 && (
              <span className="text-xs font-bold text-yellow-400">
                {review.rating}/10
              </span>
            )}
          </div>
          <div className="text-[11px] text-neutral-500">{timeAgo(review.created_at)}</div>
        </div>
      </div>

      {/* Текст рецензии */}
      <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap mb-3">
        {review.text}
      </p>

      {/* Кнопки: лайк, дизлайк, комментарии */}
      <div className="flex items-center gap-1 -ml-2">
        <button
          onClick={() => handleVote('like')}
          disabled={!userId}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50 ${
            vote === 'like'
              ? 'bg-indigo-500/20 text-indigo-400'
              : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
          }`}
        >
          <ThumbsUp className={`w-3.5 h-3.5 ${vote === 'like' ? 'fill-current' : ''}`} />
          {likes > 0 && <span>{likes}</span>}
        </button>

        <button
          onClick={() => handleVote('dislike')}
          disabled={!userId}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50 ${
            vote === 'dislike'
              ? 'bg-red-500/20 text-red-400'
              : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
          }`}
        >
          <ThumbsDown className={`w-3.5 h-3.5 ${vote === 'dislike' ? 'fill-current' : ''}`} />
          {dislikes > 0 && <span>{dislikes}</span>}
        </button>

        <button
          onClick={toggleComments}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition ${
            commentsOpen
              ? 'bg-indigo-500/20 text-indigo-400'
              : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {commentsCount > 0 && <span>{commentsCount}</span>}
          <span>Комментарии</span>
        </button>
      </div>

      {/* Комментарии */}
      {commentsOpen && (
        <div className="mt-3 pt-3 border-t border-neutral-800 space-y-3">
          {commentsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-neutral-500 text-center py-2">
              Комментариев пока нет
            </p>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => {
                const cInitials = c.nickname.substring(0, 2).toUpperCase();
                return (
                  <div key={c.id} className="flex gap-2">
                    <Link href={`/user/${c.user_id}`} className="flex-shrink-0">
                      <div className="relative w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white">
                        {c.avatar_url ? (
                          <Image
                            src={c.avatar_url}
                            alt={c.nickname}
                            fill
                            sizes="28px"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          cInitials
                        )}
                      </div>
                    </Link>
                    <div className="flex-1 min-w-0 bg-neutral-800 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Link
                            href={`/user/${c.user_id}`}
                            className="text-xs font-medium text-white hover:text-indigo-400 transition truncate"
                          >
                            {c.nickname}
                          </Link>
                          <span className="text-[10px] text-neutral-500 flex-shrink-0">
                            {timeAgo(c.created_at)}
                          </span>
                        </div>
                        {userId === c.user_id && (
                          <button
                            onClick={() => deleteComment(c.id)}
                            className="p-1 text-neutral-500 hover:text-red-400 transition flex-shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-neutral-300 leading-relaxed mt-1 whitespace-pre-wrap break-words">
                        {c.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Форма комментария */}
          {userId && (
            <div className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    postComment();
                  }
                }}
                placeholder="Написать комментарий..."
                maxLength={500}
                className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <button
                onClick={postComment}
                disabled={posting || !commentText.trim()}
                className="px-3 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg transition"
              >
                {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}