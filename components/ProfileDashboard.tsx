'use client';

import { useId, useMemo, useState, type ReactNode } from 'react';
import { ArrowUpRight, Check, Clock, Gamepad2, Layers3, MessageSquare, Radar, Sparkles, Star, Trophy, X } from 'lucide-react';
import { buildProfileDashboard, type DashboardEntry, type DashboardGameRow } from '@/lib/profile-dashboard';
import { ASPECTS, summarizeTaste } from '@/lib/aspects';
import type { Game } from '@/types/game';
import GameImage from './GameImage';

interface Props {
  nickname: string;
  games: Game[];
  userGames: DashboardGameRow[];
  reviewsCount: number;
  isOwnProfile: boolean;
  gamesLoading?: boolean;
  onGameClick: (game: Game) => void;
}

const number = (value: number) => value.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
const panel = 'min-w-0 rounded-3xl border border-white/[0.07] bg-neutral-950/40 p-4 sm:p-5';

function Heading({ icon, title, subtitle, aside }: { icon: ReactNode; title: string; subtitle: string; aside?: ReactNode }) {
  return <div className="mb-5 flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="flex items-center gap-2 text-sm font-semibold text-white">{icon}{title}</h3><p className="mt-1 text-[11px] leading-relaxed text-neutral-500">{subtitle}</p></div>{aside}</div>;
}

function GameRow({ entry, index, mode, totalHours, onClick }: { entry: DashboardEntry; index: number; mode: 'hours' | 'rating'; totalHours: number; onClick: () => void }) {
  const percent = totalHours > 0 ? Math.round(entry.hours / totalHours * 100) : 0;
  return <button type="button" onClick={onClick} disabled={!entry.game} title={entry.title}
    className="group flex w-full min-w-0 items-center gap-3 rounded-xl p-2 text-left transition hover:bg-white/5 disabled:cursor-default">
    <span className="w-3 shrink-0 text-[11px] font-medium tabular-nums text-neutral-600">{index + 1}</span>
    <span className="relative h-10 w-[76px] shrink-0 overflow-hidden rounded-lg bg-neutral-800">
      {entry.game?.cover && <GameImage src={entry.game.cover} fallback={entry.game.coverAlt} alt="" fill sizes="76px" className="object-cover" unoptimized />}
    </span>
    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-neutral-200 group-hover:text-white">{entry.title}</span><span className="mt-1 block text-[10px] text-neutral-500">{mode === 'hours' ? `${percent}% всего времени` : entry.hours > 0 ? `${number(entry.hours)} ч. в игре` : 'Личная оценка'}</span></span>
    <span className={`shrink-0 text-xs font-bold tabular-nums ${mode === 'rating' ? 'text-amber-300' : 'text-indigo-200'}`}>{mode === 'hours' ? `${number(entry.hours)} ч` : `${entry.rating}/10`}</span>
  </button>;
}

export default function ProfileDashboard({ nickname, games, userGames, reviewsCount, isOwnProfile, gamesLoading = false, onGameClick }: Props) {
  const data = useMemo(() => buildProfileDashboard(games, userGames), [games, userGames]);
  const taste = useMemo(() => summarizeTaste(data.entries.map((g) => g.aspects)), [data]);
  const [ranking, setRanking] = useState<'hours' | 'rating'>('hours');
  const [selection, setSelection] = useState<{ type: 'status'; value: string; title: string } | { type: 'rating'; value: number; title: string } | null>(null);
  const chartId = useId();
  const detailId = useId();
  const featured = data.topHours[0];
  const topGames = ranking === 'hours' ? data.topHours : data.topRated;
  const maxRatingCount = Math.max(...data.distribution.map((g) => g.count), 1);
  const selectedGames = selection ? data.entries.filter((g) => selection.type === 'status' ? g.status === selection.value : g.rating > 0 && Math.round(g.rating) === selection.value) : [];
  const radius = 70, circumference = 2 * Math.PI * radius;
  let offset = 0;
  const directions = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
  const radarPoint = (i: number, value: number) => `${140 + directions[i].x * 75 * value / 10},${118 + directions[i].y * 75 * value / 10}`;

  const metrics = [
    { icon: Gamepad2, label: 'В коллекции', value: number(data.collectionCount), hint: `${data.statuses.find((s) => s.key === 'want')!.count} в списке желаемого`, tint: 'text-indigo-300', bg: 'bg-indigo-500/10' },
    { icon: Trophy, label: 'Пройдено', value: number(data.completed), hint: `${data.completionRate}% начатых игр`, tint: 'text-emerald-300', bg: 'bg-emerald-500/10' },
    { icon: Star, label: 'Средняя оценка', value: data.averageRating === null ? '—' : data.averageRating.toFixed(1), hint: data.ratedCount ? `На основе ${data.ratedCount} оценок` : 'Пока нет оценок', tint: 'text-amber-300', bg: 'bg-amber-500/10' },
    { icon: MessageSquare, label: 'Рецензии', value: number(reviewsCount), hint: 'Опубликовано в Playlog', tint: 'text-fuchsia-300', bg: 'bg-fuchsia-500/10' },
  ];

  return <div className="space-y-4" data-testid="profile-dashboard">
    <section className="relative isolate overflow-hidden rounded-3xl border border-indigo-400/15 bg-gradient-to-br from-indigo-950/70 via-neutral-900 to-neutral-950 p-5 sm:p-7">
      <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-28 h-80 w-80 rounded-full bg-indigo-500/15 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '32px 32px' }} />
      <div className="relative grid items-center gap-6 sm:grid-cols-[1.15fr_1fr]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-300"><span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />{nickname}<span className="text-neutral-600">/</span>За всё время</div>
          <h2 className="mt-3 text-xl font-bold tracking-tight text-white sm:text-2xl">Библиотека в цифрах</h2>
          <p className="mt-1 text-xs text-neutral-400">Игры, впечатления и время, проведённое в других мирах.</p>
          <div className="mt-6 flex flex-wrap items-baseline gap-x-2"><span className="break-all text-5xl font-extrabold tracking-tight text-white tabular-nums sm:text-6xl">{number(data.totalHours)}</span><span className="text-xl font-medium text-indigo-300">часов</span></div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-neutral-400"><span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-indigo-400" />{number(data.totalHours / 24)} суток в игровых мирах</span><span>{data.timedCount} игр с учтённым временем</span></div>
        </div>
        {featured ? <button type="button" onClick={() => featured.game && onGameClick(featured.game)} disabled={!featured.game}
          className="group relative flex min-h-[178px] min-w-0 flex-col justify-end overflow-hidden rounded-2xl border border-white/10 bg-neutral-800 p-4 text-left transition hover:border-indigo-400/60 sm:min-h-[214px]">
          {featured.game?.cover && <GameImage src={featured.game.cover} fallback={featured.game.coverAlt} alt="" fill sizes="(max-width: 640px) 100vw, 480px" className="object-cover" unoptimized />}
          <span className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/20" />
          <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[10px] text-white/80 backdrop-blur"><Trophy className="h-3 w-3 text-amber-300" />Больше всего времени</span>
          <ArrowUpRight className="absolute right-4 top-4 h-4 w-4 text-white/70 transition group-hover:text-white" />
          <span className="relative"><span className="block text-lg font-bold leading-tight text-white line-clamp-2">{featured.title}</span><span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/60"><b className="text-white">{number(featured.hours)} ч.</b><span className="h-1 w-1 rounded-full bg-white/30" />{Math.round(featured.hours / data.totalHours * 100)}% всего времени</span></span>
        </button> : <div className="flex min-h-[178px] flex-col items-center justify-center rounded-2xl border border-dashed border-indigo-400/20 bg-indigo-500/5 p-5 text-center"><Clock className="mb-3 h-9 w-9 text-indigo-300/70" /><p className="text-sm font-medium text-white">Большие приключения ещё впереди</p><p className="mt-2 max-w-xs text-xs leading-relaxed text-neutral-500">{isOwnProfile ? 'Добавляй часы в карточках игр — здесь появится твоя главная игра по времени.' : 'Пользователь пока не указал время в играх.'}</p></div>}
      </div>
    </section>

    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
      {metrics.map(({ icon: Icon, label, value, hint, tint, bg }) => <section key={label} className="min-w-0 rounded-2xl border border-white/[0.07] bg-neutral-950/40 p-3.5 sm:p-4"><div className="flex items-center gap-2"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${bg} ${tint}`}><Icon className="h-3.5 w-3.5" /></span><h3 className="text-[11px] text-neutral-400">{label}</h3></div><p className="mt-4 break-all text-3xl font-bold tracking-tight text-white tabular-nums">{value}</p><p className="mt-1.5 text-[10px] leading-relaxed text-neutral-500">{hint}</p></section>)}
    </div>

    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <section className={panel}>
        <Heading icon={<Layers3 className="h-4 w-4 text-indigo-300" />} title="Путь по библиотеке" subtitle="Все списки, включая желаемое. Нажми на статус, чтобы увидеть игры." />
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5">
          <div className="relative h-[186px] w-[186px] shrink-0">
            <svg viewBox="0 0 180 180" role="img" aria-label={`Распределение ${data.entries.length} игр по статусам`} className="h-full w-full -rotate-90"><circle cx="90" cy="90" r={radius} fill="none" stroke="#242429" strokeWidth="15" />{data.statuses.filter((s) => s.count > 0).map((s) => {
              const length = data.entries.length ? s.count / data.entries.length * circumference : 0;
              const segment = <circle key={s.key} cx="90" cy="90" r={radius} fill="none" stroke={s.color} strokeWidth="15" strokeDasharray={`${Math.max(length - 3, 0)} ${circumference - Math.max(length - 3, 0)}`} strokeDashoffset={-offset}><title>{s.label}: {s.count}</title></circle>;
              offset += length; return segment;
            })}</svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-4xl font-bold tracking-tight text-white tabular-nums">{data.entries.length}</span><span className="mt-1 text-[10px] uppercase tracking-wider text-neutral-500">всего в списках</span></div>
          </div>
          <div className="w-full min-w-0 flex-1 space-y-1">
            {data.statuses.map((s) => <button key={s.key} type="button" aria-controls={detailId} aria-pressed={selection?.type === 'status' && selection.value === s.key} onClick={() => setSelection((prev) => prev?.type === 'status' && prev.value === s.key ? null : { type: 'status', value: s.key, title: s.label })} className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs transition hover:bg-white/5 ${selection?.type === 'status' && selection.value === s.key ? 'bg-white/5' : ''}`}><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} /><span className="text-neutral-300">{s.label}</span><span className="ml-auto font-semibold text-white tabular-nums">{s.count}</span><span className="w-9 text-right text-[10px] text-neutral-500">{data.entries.length ? Math.round(s.count / data.entries.length * 100) : 0}%</span></button>)}
          </div>
        </div>
        <div className="mt-4 border-t border-white/5 pt-3"><div className="mb-2 flex items-center justify-between gap-2 text-[11px]"><span className="text-neutral-500">Пройдено из начатых</span><span className="font-semibold text-emerald-300">{data.completionRate}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-neutral-800"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-300" style={{ width: `${data.completionRate}%` }} /></div><p className="mt-2 text-[10px] text-neutral-600">{data.completed} из {data.started} · без желаемого и игр без статуса</p></div>
      </section>

      <section className={panel}>
        <Heading icon={<Star className="h-4 w-4 text-amber-300" />} title={isOwnProfile ? "Как ты оцениваешь игры" : "Личные оценки"} subtitle="Личные оценки от 1 до 10. Нажми на столбик, чтобы увидеть игры." aside={<span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300">{data.ratedCount} оценок</span>} />
        <div className="flex h-[188px] items-end gap-1.5 border-b border-white/5 pb-2 sm:gap-2" role="group" aria-label="Распределение оценок">
          {data.distribution.map((bucket) => <button key={bucket.rating} type="button" disabled={!bucket.count} aria-controls={detailId} aria-label={`Оценка ${bucket.rating}: ${bucket.count} игр`} aria-pressed={selection?.type === 'rating' && selection.value === bucket.rating} onClick={() => setSelection((prev) => prev?.type === 'rating' && prev.value === bucket.rating ? null : { type: 'rating', value: bucket.rating, title: `Оценка ${bucket.rating}/10` })} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2 rounded-t-lg outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-default">
            <span className={`text-[10px] tabular-nums ${bucket.count ? 'text-neutral-400' : 'text-neutral-700'}`}>{bucket.count || '·'}</span>
            <span className="w-full max-w-9 rounded-t-md transition-opacity group-hover:opacity-80" style={{ height: bucket.count ? `${Math.max(bucket.count / maxRatingCount * 124, 5)}px` : '3px', background: bucket.count ? bucket.rating >= 8 ? 'linear-gradient(to top,#047857,#34d399)' : bucket.rating >= 5 ? 'linear-gradient(to top,#a16207,#fbbf24)' : 'linear-gradient(to top,#9f1239,#fb7185)' : '#29292d' }} />
            <span className="text-[10px] text-neutral-500">{bucket.rating}</span>
          </button>)}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3"><div><p className="text-xl font-bold text-white">{data.averageRating === null ? '—' : data.averageRating.toFixed(1)}<span className="ml-1 text-xs font-normal text-neutral-600">/ 10</span></p><p className="mt-1 text-[10px] text-neutral-500">средняя личная оценка</p></div><div className="border-l border-white/5 pl-4"><p className="text-xl font-bold text-emerald-300">{data.entries.filter((g) => g.rating >= 8).length}</p><p className="mt-1 text-[10px] text-neutral-500">игр с оценкой 8 и выше</p></div></div>
        {!data.ratedCount && <p className="mt-3 text-xs text-neutral-500">{isOwnProfile ? 'Поставь первую оценку — и график оживёт.' : 'Личных оценок пока нет.'}</p>}
      </section>

      {selection && <section id={detailId} className={`${panel} lg:col-span-2`} aria-live="polite"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-white">{selection.title}<span className="ml-2 text-xs font-normal text-neutral-500">{selectedGames.length} игр</span></h3><button type="button" onClick={() => setSelection(null)} aria-label="Закрыть список игр" className="rounded-lg p-1.5 text-neutral-500 hover:bg-white/5 hover:text-white"><X className="h-4 w-4" /></button></div>{selectedGames.length ? <div className="grid max-h-72 gap-x-4 overflow-y-auto sm:grid-cols-2">{selectedGames.map((g, i) => <GameRow key={g.id} entry={g} index={i} mode={selection.type === 'rating' ? 'rating' : 'hours'} totalHours={data.totalHours} onClick={() => g.game && onGameClick(g.game)} />)}</div> : <p className="py-3 text-xs text-neutral-500">В этом списке пока нет игр.</p>}</section>}

      <section className={panel}>
        <Heading icon={<Trophy className="h-4 w-4 text-amber-300" />} title="Игры, которые выделяются" subtitle={ranking === 'hours' ? 'Больше всего учтённого игрового времени' : 'Самые высокие личные оценки'} aside={<div className="flex shrink-0 rounded-lg border border-white/5 bg-neutral-900 p-0.5" role="group" aria-label="Сортировка лучших игр">{(['hours', 'rating'] as const).map((mode) => <button key={mode} type="button" onClick={() => setRanking(mode)} aria-pressed={ranking === mode} className={`rounded-md px-2 py-1 text-[10px] transition ${ranking === mode ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-200'}`}>{mode === 'hours' ? 'Часы' : 'Оценка'}</button>)}</div>} />
        {topGames.length ? <div className="space-y-1">{topGames.map((entry, i) => <GameRow key={entry.id} entry={entry} index={i} mode={ranking} totalHours={data.totalHours} onClick={() => entry.game && onGameClick(entry.game)} />)}</div> : <div className="flex min-h-44 flex-col items-center justify-center gap-2 text-center"><Gamepad2 className="h-7 w-7 text-neutral-700" /><p className="text-xs text-neutral-500">{ranking === 'hours' ? 'Нет игр с указанными часами' : 'Нет игр с личной оценкой'}</p></div>}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/5 pt-3 text-[11px]"><span className="text-neutral-500">В среднем на игру с учтённым временем</span><span className="shrink-0 font-semibold text-indigo-200">{number(data.averageHours)} ч.</span></div>
      </section>

      <section className={panel}>
        <Heading icon={<Sparkles className="h-4 w-4 text-fuchsia-300" />} title="Жанры коллекции" subtitle="Доля игр с этим жанром. Одна игра может относиться к нескольким жанрам." />
        {data.genres.length ? <div className="space-y-4">{data.genres.map(([genre, count], i) => <div key={genre}><div className="mb-2 flex items-center justify-between gap-3 text-xs"><span className="truncate text-neutral-300" title={genre}>{genre}</span><span className="shrink-0 text-[10px] text-neutral-500">{count} игр <span className="mx-1 text-neutral-700">/</span><b className="font-medium text-neutral-300">{Math.round(count / data.collectionCount * 100)}%</b></span></div><div className="h-2 overflow-hidden rounded-full bg-neutral-800/70"><div className="h-full rounded-full" style={{ width: `${count / data.collectionCount * 100}%`, background: ['linear-gradient(90deg,#6366f1,#a78bfa)','linear-gradient(90deg,#9333ea,#e879f9)','linear-gradient(90deg,#0284c7,#67e8f9)','linear-gradient(90deg,#059669,#6ee7b7)','linear-gradient(90deg,#d97706,#fcd34d)','linear-gradient(90deg,#e11d48,#fda4af)'][i] }} /></div></div>)}</div> : <div className="flex min-h-44 items-center justify-center text-center text-xs text-neutral-500">{gamesLoading ? 'Загружаем данные игр…' : 'Жанры появятся, когда будут доступны данные игр коллекции.'}</div>}
        <p className="mt-4 border-t border-white/5 pt-3 text-[10px] text-neutral-600">Жанры доступны для {data.gamesWithGenres} из {data.collectionCount} игр коллекции · желаемое не учитывается</p>
      </section>

      <section className={`${panel} lg:col-span-2`}>
        <Heading icon={<Radar className="h-4 w-4 text-indigo-300" />} title="Что важно в игре" subtitle="Средние оценки по геймплею, сюжету, графике и музыке" aside={taste.archetype ? <span className="shrink-0 rounded-full border border-indigo-400/15 bg-indigo-500/10 px-2.5 py-1 text-[10px] text-indigo-300">{taste.archetype.title}</span> : undefined} />
        {taste.gamesCount ? <div className="grid items-center gap-5 sm:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr]">
          <svg viewBox="0 0 280 236" role="img" aria-label="Радар средних оценок по аспектам" className="mx-auto w-full max-w-[280px]"><defs><linearGradient id={chartId} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#818cf8" stopOpacity=".5" /><stop offset="100%" stopColor="#e879f9" stopOpacity=".12" /></linearGradient></defs>{[2.5,5,7.5,10].map((level) => <polygon key={level} points={directions.map((_,i) => radarPoint(i,level)).join(' ')} fill="none" stroke="#303038" strokeWidth="1" />)}{directions.map((_,i) => <line key={i} x1="140" y1="118" x2={140 + directions[i].x * 75} y2={118 + directions[i].y * 75} stroke="#303038" />)}<polygon points={ASPECTS.map((a,i) => radarPoint(i,taste.averages[a.key])).join(' ')} fill={`url(#${chartId})`} stroke="#a5b4fc" strokeWidth="2" />{ASPECTS.map((a,i) => { const [cx,cy] = radarPoint(i,taste.averages[a.key]).split(',').map(Number);return <circle key={a.key} cx={cx} cy={cy} r="4" fill={a.color} stroke="#171717" strokeWidth="2" />; })}<text x="140" y="21" textAnchor="middle" fill="#a3a3a3" fontSize="10">Геймплей</text><text x="231" y="121" fill="#a3a3a3" fontSize="10">Сюжет</text><text x="140" y="218" textAnchor="middle" fill="#a3a3a3" fontSize="10">Графика</text><text x="49" y="121" textAnchor="end" fill="#a3a3a3" fontSize="10">Музыка</text></svg>
          <div className="space-y-4">{ASPECTS.map((a) => <div key={a.key}><div className="mb-2 flex items-center justify-between gap-2 text-xs"><span className="text-neutral-300">{a.label}<span className="ml-2 text-[10px] text-neutral-600">{taste.counts[a.key]} оценок</span></span><b style={{color:a.color}}>{taste.counts[a.key] ? taste.averages[a.key].toFixed(1) : '—'}<span className="ml-1 font-normal text-neutral-600">/10</span></b></div><div className="h-1.5 overflow-hidden rounded-full bg-neutral-800"><div className="h-full rounded-full" style={{width:`${taste.averages[a.key] * 10}%`,background:a.color}} /></div></div>)}<p className="text-[11px] leading-relaxed text-neutral-500">{taste.archetype?.hint} · По {taste.gamesCount} играм с оценками аспектов.</p></div>
        </div> : <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/10 bg-neutral-900/50 px-5 py-8 text-center"><Radar className="h-8 w-8 text-indigo-400/60" /><p className="text-sm text-neutral-300">У каждой игры есть свои сильные стороны</p><p className="max-w-md text-xs leading-relaxed text-neutral-500">{isOwnProfile ? 'Оцени геймплей, сюжет, графику и музыку в карточках игр. Здесь появится твой игровой портрет.' : 'Пользователь пока не выставлял оценки по аспектам.'}</p></div>}
      </section>
    </div>
    <p className="flex items-start gap-1.5 px-1 text-[10px] leading-relaxed text-neutral-600"><Check className="mt-0.5 h-3 w-3 shrink-0" />По данным профиля Playlog. Часы и оценки указаны пользователем; история по дням не рассчитывается.</p>
  </div>;
}
