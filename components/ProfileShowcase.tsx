'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BarChart3, Clock, Loader2, MessageSquare, Plus, Settings2, Star } from 'lucide-react';
import { authFetch } from '@/lib/api-client';
import { ACHIEVEMENTS, type AchievementStats } from '@/lib/achievements';
import { initialShowcase, parseShowcase, SHOWCASE_METRICS, type ShowcaseSlot, type ShowcaseMetric } from '@/lib/profile-showcase';
import { getAchievementLevel, type Game, type GameData } from '@/types/game';
import AchievementBadge from './AchievementBadge';
import AchievementsModal from './AchievementsModal';
import GameImage from './GameImage';
import ProfileDialog from './ProfileDialog';

export interface ShowcaseReview {
  id: string;
  game_id: number;
  game_title: string;
  game_cover: string | null;
  rating: number | null;
  text: string;
}

interface Props {
  profileId: string;
  isOwnProfile: boolean;
  games: Game[];
  userData: Map<number, GameData>;
  reviews: ShowcaseReview[];
  favoriteIds: number[];
  onGameClick: (game: Game) => void;
  onOpenStats: () => void;
}

const fieldClass = 'w-full min-w-0 rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400';

export default function ProfileShowcase({ profileId, isOwnProfile, games, userData, reviews, favoriteIds, onGameClick, onOpenStats }: Props) {
  const [saved, setSaved] = useState<ShowcaseSlot[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ShowcaseSlot[]>(initialShowcase([]));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<ShowcaseReview | null>(null);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const slots = saved || initialShowcase(favoriteIds);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError(false); setSaved(null);
    fetch(`/api/users/${profileId}/showcase`, { signal: controller.signal, cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('load');
        const data = await res.json();
        if (controller.signal.aborted) return;
        if (data.slots !== null && !parseShowcase(data.slots)) throw new Error('shape');
        setSaved(data.slots === null ? null : parseShowcase(data.slots));
      })
      .catch(() => { if (!controller.signal.aborted) setLoadError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [profileId, retry]);

  const achievementStats = useMemo<AchievementStats>(() => {
    const rows = [...userData.values()];
    return {
      total: rows.length,
      completed: rows.filter((g) => g.status === 'completed').length,
      playing: rows.filter((g) => g.status === 'playing').length,
      want: rows.filter((g) => g.status === 'want').length,
      dropped: rows.filter((g) => g.status === 'dropped').length,
      totalHours: rows.reduce((sum, g) => sum + (g.hours || 0), 0),
      ratedGames: rows.filter((g) => g.rating > 0).length,
      reviewsCount: rows.filter((g) => g.review && g.review.length > 0).length,
    };
  }, [userData]);
  const unlocked = ACHIEVEMENTS.filter((a) => a.getValue(achievementStats) >= a.thresholds[0]);
  const sortedGames = useMemo(() => [...games].sort((a, b) => a.title.localeCompare(b.title, 'ru')), [games]);

  function statValue(metric: ShowcaseMetric): string {
    const s = achievementStats;
    const ratings = [...userData.values()].filter((g) => g.rating > 0);
    switch (metric) {
      case 'games': return [...userData.values()].filter((g) => g.status !== 'want' && g.status !== 'none').length.toLocaleString('ru-RU');
      case 'completed': return s.completed.toLocaleString('ru-RU');
      case 'hours': return s.totalHours.toLocaleString('ru-RU');
      case 'rating': return ratings.length ? (ratings.reduce((sum, g) => sum + g.rating, 0) / ratings.length).toFixed(1) : '—';
      case 'completion': { const total = [...userData.values()].filter((g) => g.status !== 'want' && g.status !== 'none').length; return `${total ? Math.round(s.completed / total * 100) : 0}%`; }
      case 'reviews': return reviews.length.toLocaleString('ru-RU');
      case 'playing': return String(s.playing);
      case 'want': return String(s.want);
    }
  }

  function beginEdit() { setDraft(slots.map((s) => ({ ...s }))); setError(null); setEditing(true); }
  function change(index: number, value: ShowcaseSlot) { setDraft((prev) => prev.map((s, i) => i === index ? value : s)); }
  function move(index: number, by: number) {
    setDraft((prev) => {
      const next = [...prev];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
  }
  function chooseType(index: number, type: ShowcaseSlot['type']) {
    const hidden = draft[index].hidden;
    const next: ShowcaseSlot = type === 'game' ? { type, gameId: sortedGames[0]?.id || 0, hidden }
      : type === 'review' ? { type, reviewId: reviews[0]?.id || '', hidden }
      : type === 'achievement' ? { type, achievementId: unlocked[0]?.id || '', hidden }
      : type === 'stat' ? { type, metric: 'hours', hidden }
      : { type: 'empty' };
    change(index, next);
  }
  async function save() {
    if (!parseShowcase(draft)) { setError('Выбери содержимое каждого блока или оставь его пустым.'); return; }
    setSaving(true); setError(null);
    try {
      const response = await authFetch(`/api/users/${profileId}/showcase`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slots: draft }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось сохранить витрину');
      const parsed = parseShowcase(data.slots);
      if (!parsed) throw new Error('Не удалось проверить сохранённую витрину');
      setSaved(parsed); setEditing(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось сохранить. Попробуй ещё раз.'); }
    finally { setSaving(false); }
  }

  function content(slot: ShowcaseSlot) {
    if (slot.type === 'game') {
      const game = games.find((g) => g.id === slot.gameId);
      if (!game) return null;
      const data = userData.get(game.id);
      return <button type="button" onClick={() => onGameClick(game)} className="group relative flex h-36 w-full flex-col justify-end overflow-hidden rounded-2xl border border-white/10 bg-neutral-800 text-left transition hover:border-indigo-400/60 sm:h-40">
        <GameImage src={game.cover} fallback={game.coverAlt} alt="" fill sizes="(max-width: 640px) 50vw, 260px" className="object-cover" unoptimized />
        <span className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/10" />
        <span className="absolute left-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[10px] font-medium text-white/80">Любимая игра</span>
        <span className="relative p-3">
          <span className="block text-sm font-bold leading-snug text-white line-clamp-2">{game.title}</span>
          {(!!data?.rating || !!data?.hours) && <span className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-white/70">
            {!!data?.rating && <span className="inline-flex items-center gap-1 text-amber-300"><Star className="h-3 w-3 fill-current" />{data.rating}/10</span>}
            {!!data?.hours && <span>{data.hours} ч.</span>}
          </span>}
        </span>
      </button>;
    }
    if (slot.type === 'stat') {
      const Icon = slot.metric === 'hours' ? Clock : slot.metric === 'reviews' ? MessageSquare : slot.metric === 'rating' ? Star : BarChart3;
      const tint = slot.metric === 'hours' ? '#818cf8' : slot.metric === 'rating' ? '#fbbf24' : slot.metric === 'reviews' ? '#e879f9' : '#34d399';
      return <button type="button" onClick={onOpenStats} className="group relative flex h-36 w-full items-center overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/70 p-3 text-left transition hover:border-white/25 sm:h-40 sm:p-4">
        <span aria-hidden="true" className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 100% 0%, ${tint}24, transparent 75%)` }} />
        <Icon aria-hidden="true" className="pointer-events-none absolute -bottom-3 -right-3 h-28 w-28 -rotate-12 opacity-[0.07] sm:h-32 sm:w-32" style={{ color: tint }} strokeWidth={1} />
        <span className="relative block min-w-0 flex-1">
          <span className="mb-3 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-neutral-500"><Icon className="h-3.5 w-3.5" style={{ color: tint }} />Статистика</span>
          <span className="block break-all text-3xl font-extrabold leading-none tracking-tight text-white tabular-nums sm:text-4xl">{statValue(slot.metric)}</span>
          <span className="mt-2 block text-[11px] font-medium leading-snug text-neutral-400">{SHOWCASE_METRICS[slot.metric]}</span>
        </span>
        <span aria-hidden="true" className="absolute right-3 top-3 text-neutral-600 transition group-hover:text-neutral-300">↗</span>
      </button>;
    }
    if (slot.type === 'review') {
      const review = reviews.find((r) => r.id === slot.reviewId);
      if (!review) return null;
      return <button type="button" onClick={() => setSelectedReview(review)} className="flex h-36 w-full flex-col rounded-2xl border border-amber-400/15 bg-gradient-to-br from-amber-500/10 to-neutral-800/40 p-3 text-left transition hover:border-amber-400/60 sm:h-40 sm:p-4">
        <span className="flex items-center gap-1.5 text-[10px] text-amber-300"><MessageSquare className="h-3.5 w-3.5" />Рецензия{review.rating ? ` · ${review.rating}/10` : ''}</span>
        <span className="mt-2 block text-sm font-bold text-white line-clamp-1">{review.game_title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-neutral-400 line-clamp-3">{review.text}</span>
      </button>;
    }
    if (slot.type === 'achievement') {
      const achievement = unlocked.find((a) => a.id === slot.achievementId);
      if (!achievement) return null;
      const { level } = getAchievementLevel(achievement.thresholds, achievement.getValue(achievementStats));
      return <button type="button" onClick={() => setAchievementsOpen(true)} className="flex h-36 w-full items-center gap-2 overflow-hidden rounded-2xl border border-emerald-400/15 bg-gradient-to-br from-emerald-500/10 to-neutral-800/40 p-3 text-left transition hover:border-emerald-400/60 sm:h-40">
        <span className="shrink-0"><AchievementBadge id={achievement.id} level={level} size={56} /></span>
        <span className="min-w-0"><span className="block text-[10px] text-emerald-300">Достижение · ур. {level}</span><span className="mt-1 block break-words text-sm font-bold text-white">{achievement.title}</span></span>
      </button>;
    }
    return null;
  }

  const visible = slots.map((slot, index) => ({ slot, index, node: slot.hidden ? null : content(slot) }));
  return <>
    {(isOwnProfile || (!loading && visible.some((s) => s.node))) && <section className="mt-5" aria-label="Витрина профиля">
      {isOwnProfile && <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-300">Моя витрина</h2>
        <button type="button" onClick={beginEdit} disabled={loading || loadError} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-indigo-300 transition hover:bg-indigo-500/10 disabled:opacity-40"><Settings2 className="h-3.5 w-3.5" />Настроить</button>
      </div>}
      {loading ? <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-indigo-400" /></div>
        : loadError ? isOwnProfile && <p role="alert" className="text-sm text-neutral-400">Не удалось загрузить витрину. <button type="button" onClick={() => setRetry((n) => n + 1)} className="text-indigo-300 underline">Повторить</button></p>
        : <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          {visible.map(({ slot, index, node }) => node ? <div key={index} className="min-w-0">{node}</div>
            : isOwnProfile && <button key={index} type="button" onClick={beginEdit} className="flex h-36 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-700 bg-neutral-800/20 text-xs text-neutral-500 transition hover:border-indigo-400/50 hover:text-indigo-300 sm:h-40"><Plus className="h-5 w-5" />{slot.hidden ? 'Скрытый блок' : slot.type === 'empty' ? 'Добавить блок' : 'Выбрать заново'}</button>)}
        </div>}
    </section>}

    <ProfileDialog open={editing && isOwnProfile} title="Настроить витрину" onClose={() => { if (!saving) setEditing(false); }}>
      <p className="mb-5 text-sm text-neutral-400">В каждом блоке можно выбрать любой тип. Например, поставить четыре любимые игры.</p>
      <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <fieldset disabled={saving} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          {draft.map((slot, index) => <div key={index} className="min-w-0 space-y-3 rounded-2xl border border-neutral-800 bg-neutral-950/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-white">Блок {index + 1}</span>
              <span className="flex gap-1">
                <button type="button" aria-label={`Передвинуть блок ${index + 1} влево`} disabled={index === 0} onClick={() => move(index, -1)} className="rounded-lg bg-neutral-800 p-1.5 text-neutral-300 disabled:opacity-25"><ArrowLeft className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label={`Передвинуть блок ${index + 1} вправо`} disabled={index === 3} onClick={() => move(index, 1)} className="rounded-lg bg-neutral-800 p-1.5 text-neutral-300 disabled:opacity-25"><ArrowRight className="h-3.5 w-3.5" /></button>
              </span>
            </div>
            <label className="block text-xs text-neutral-400">Тип блока
              <select aria-label={`Тип блока ${index + 1}`} value={slot.type} onChange={(e) => chooseType(index, e.target.value as ShowcaseSlot['type'])} className={`${fieldClass} mt-1.5`}>
                <option value="empty">Пустой блок</option><option value="game">Любимая игра</option><option value="stat">Статистика</option><option value="review">Рецензия</option><option value="achievement">Достижение</option>
              </select>
            </label>
            {slot.type === 'game' && <label className="block text-xs text-neutral-400">Игра из библиотеки
              <select aria-label={`Игра блока ${index + 1}`} value={slot.gameId} onChange={(e) => change(index, { ...slot, gameId: Number(e.target.value) })} className={`${fieldClass} mt-1.5`}><option value={0}>Выбери игру</option>{sortedGames.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select>
              {games.length === 0 && <span className="mt-2 block">Сначала добавь игру в библиотеку.</span>}
            </label>}
            {slot.type === 'stat' && <label className="block text-xs text-neutral-400">Показатель
              <select aria-label={`Показатель блока ${index + 1}`} value={slot.metric} onChange={(e) => change(index, { ...slot, metric: e.target.value as ShowcaseMetric })} className={`${fieldClass} mt-1.5`}>{Object.entries(SHOWCASE_METRICS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
            </label>}
            {slot.type === 'review' && <label className="block text-xs text-neutral-400">Опубликованная рецензия
              <select aria-label={`Рецензия блока ${index + 1}`} value={slot.reviewId} onChange={(e) => change(index, { ...slot, reviewId: e.target.value })} className={`${fieldClass} mt-1.5`}><option value="">Выбери рецензию</option>{reviews.map((r) => <option key={r.id} value={r.id}>{r.game_title}</option>)}</select>
              {!reviews.length && <span className="mt-2 block">Сначала опубликуй рецензию к игре.</span>}
            </label>}
            {slot.type === 'achievement' && <label className="block text-xs text-neutral-400">Полученное достижение
              <select aria-label={`Достижение блока ${index + 1}`} value={slot.achievementId} onChange={(e) => change(index, { ...slot, achievementId: e.target.value })} className={`${fieldClass} mt-1.5`}><option value="">Выбери достижение</option>{unlocked.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select>
              {!unlocked.length && <span className="mt-2 block">Здесь появятся полученные достижения.</span>}
            </label>}
            {slot.type !== 'empty' && <label className="flex items-center gap-2 text-xs text-neutral-400"><input type="checkbox" checked={!slot.hidden} onChange={(e) => change(index, { ...slot, hidden: !e.target.checked })} className="accent-indigo-500" />Показывать в профиле</label>}
          </div>)}
        </fieldset>
        {error && <p role="alert" className="mt-4 text-sm text-rose-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={saving} onClick={() => setEditing(false)} className="rounded-xl border border-neutral-700 px-4 py-2.5 text-sm text-neutral-300 disabled:opacity-50">Отмена</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Сохранить</button>
        </div>
      </form>
    </ProfileDialog>
    <ProfileDialog open={!!selectedReview} title={selectedReview?.game_title || 'Рецензия'} onClose={() => setSelectedReview(null)}>
      {selectedReview && <><p className="mb-3 text-sm text-amber-300">{selectedReview.rating ? `${selectedReview.rating}/10` : 'Рецензия'}</p><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-200">{selectedReview.text}</p></>}
    </ProfileDialog>
    <AchievementsModal isOpen={achievementsOpen} onClose={() => setAchievementsOpen(false)} stats={achievementStats} />
  </>;
}
