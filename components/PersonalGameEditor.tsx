'use client';

import { useState } from 'react';
import { Check, Gamepad2, Heart, Loader2, Save, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/api-client';
import { aspectColumns, emptyAspects, hasAspects } from '@/lib/aspects';
import { fetchRewards } from '@/lib/rewards';
import type { Game, GameData } from '@/types/game';
import GamePersonalFields from './GamePersonalFields';
import ReviewComposer from './ReviewComposer';

const statuses = [
  { value: 'want', label: 'Хочу', Icon: Heart },
  { value: 'playing', label: 'Играю', Icon: Gamepad2 },
  { value: 'completed', label: 'Прошёл', Icon: Check },
  { value: 'dropped', label: 'Заброшено', Icon: XCircle },
] as const;

/** Сохраняет данные текущего пользователя, сохраняя адрес открытого профиля. */
export default function PersonalGameEditor({ game, onSaved }: { game: Game; onSaved: () => void }) {
  const { userId, userGames, setUserGames, setProfile } = useAuth();
  const { showToast } = useToast();
  const initial = userGames.get(game.id);
  const [rating, setRating] = useState(initial?.rating || 0);
  const [hours, setHours] = useState(initial?.hours || 0);
  const [aspects, setAspects] = useState(initial?.aspects || emptyAspects());
  const [review, setReview] = useState(initial?.review || '');
  const [status, setStatus] = useState<GameData['status']>(initial?.status || 'none');
  const [saving, setSaving] = useState(false);

  async function save(publish = false): Promise<boolean> {
    if (!userId || saving) return false;
    if (publish && review.trim().length < 20) return false;
    if (!initial && status === 'none' && !rating && !hours && !review.trim() && !hasAspects(aspects)) {
      showToast('Выбери статус игры или добавь оценку', 'info'); return false;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('user_games').upsert({
        user_id: userId, game_id: game.id, rating, hours, review, status,
        ...(hasAspects(aspects) || hasAspects(initial?.aspects) ? aspectColumns(aspects) : {}),
      }, { onConflict: 'user_id,game_id' });
      if (error) throw error;
      const record: GameData = { rating, hours, review, status, aspects, xp: 0, updatedAt: new Date().toISOString() };
      setUserGames((prev) => new Map(prev).set(game.id, record));
      try { sessionStorage.removeItem(`playlog:user-cache:${userId}`); } catch {}
      onSaved();
      void fetchRewards(userId).then((reward) => {
        if (reward) setProfile((prev) => ({ ...prev, xp: reward.xp, coins: reward.coins }));
      });
      if (publish) {
        const res = await authFetch('/api/reviews', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId: game.id, gameTitle: game.title, gameCover: game.cover, rating: rating || null, text: review.trim() }),
        });
        if (!res.ok) { showToast('Игра сохранена, но отзыв не опубликован. Попробуй ещё раз.', 'error'); return false; }
        onSaved();
      }
      showToast(publish ? 'Отзыв опубликован' : 'Сохранено в твоей библиотеке', 'success');
      return true;
    } catch {
      showToast('Не удалось сохранить. Попробуй ещё раз.', 'error'); return false;
    } finally { setSaving(false); }
  }

  if (!userId) return null;
  return <section className="space-y-3 rounded-2xl border border-indigo-400/20 bg-indigo-500/[0.04] p-3 sm:p-4">
    <div><h2 className="text-sm font-semibold text-white">Твоя библиотека</h2><p className="mt-1 text-[11px] text-neutral-500">Оценка, статус и часы сохраняются в твоём профиле.</p></div>
    <fieldset disabled={saving} className="min-w-0 space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{statuses.map(({ value, label, Icon }) => <button key={value} type="button" onClick={() => setStatus((prev) => prev === value ? 'none' : value)} aria-pressed={status === value} className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs font-medium transition ${status === value ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-100' : 'border-neutral-700/70 bg-neutral-900/50 text-neutral-400 hover:text-white'}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}</div>
      <GamePersonalFields gameId={game.id} playtime={game.playtime} rating={rating} hours={hours} aspects={aspects} onRating={setRating} onHours={setHours} onAspects={setAspects} />
      <ReviewComposer value={review} onChange={setReview} onPublish={() => save(true)} />
      <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Сохранить в библиотеку</button>
    </fieldset>
  </section>;
}
