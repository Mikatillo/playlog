'use client';

import { fetchRewards } from '@/lib/rewards';
import { authFetch } from '@/lib/api-client';
import { useEffect, useState, useMemo } from 'react';
import {
  Calendar, Loader2, Gamepad2, X, Heart, XCircle,
  MessageSquare, ChevronDown, ChevronUp, Lock,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Game } from '@/types/game';
import { mapRawgGame, RawgGame } from '@/lib/rawg';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import GameMediaCarousel from '@/components/GameMediaCarousel';
import ReviewsSection from '@/components/ReviewsSection';

function formatDay(iso?: string, year?: number): string {
  if (!iso && !year) return 'Дата не объявлена';
  if (!iso) return String(year);
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return String(year || '—');
  }
}

function getMonthLabel(iso?: string, year?: number): string {
  if (!iso && !year) return 'Дата не объявлена';
  if (!iso) return `Год ${year}`;
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  } catch {
    return `Год ${year || ''}`;
  }
}

export default function ReleasesPage() {
  const { userId, userGames, setUserGames, setProfile } = useAuth();
  const { showToast } = useToast();

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [descriptionRu, setDescriptionRu] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [comment, setComment] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [gameStatus, setGameStatus] = useState<'none' | 'want' | 'dropped'>('none');
  const [savedTick, setSavedTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/games/releases')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const mapped = (data.results || [])
          .map((g: RawgGame) => mapRawgGame(g))
          .filter((g: Game) => g.year > 0);
        setGames(mapped);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedGame) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeGame();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [selectedGame]);

  const grouped = useMemo(() => {
    const map = new Map<string, Game[]>();
    games.forEach((g) => {
      const key = getMonthLabel(g.released, g.year);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    });
    return Array.from(map.entries());
  }, [games]);

  const translateDescription = async (text: string, gameId: number) => {
    const cached = localStorage.getItem(`translation_${gameId}`);
    if (cached) {
      setDescriptionRu(cached);
      return;
    }
    if (/[а-яА-ЯёЁ]/.test(text)) {
      setDescriptionRu(text);
      localStorage.setItem(`translation_${gameId}`, text);
      return;
    }
    setTranslating(true);
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      if (data.translatedText) {
        setDescriptionRu(data.translatedText);
        localStorage.setItem(`translation_${gameId}`, data.translatedText);
      } else {
        setDescriptionRu(text);
      }
    } catch {
      setDescriptionRu(text);
    }
    setTranslating(false);
  };

  const openGame = async (game: Game) => {
    setSelectedGame(game);
    setDescriptionExpanded(false);
    setDescriptionRu(null);
    setTranslating(false);
    setComment('');

    const data = userGames.get(game.id);
    if (data && (data.status === 'want' || data.status === 'dropped')) {
      setGameStatus(data.status);
    } else {
      setGameStatus('none');
    }

    setModalLoading(true);
    try {
      const res = await fetch(`/api/games/${game.id}?full=true`);
      if (res.ok) {
        const rawData = await res.json();
        const fullGame = mapRawgGame(rawData);
        setSelectedGame(fullGame);
        if (fullGame.descriptionRaw) {
          translateDescription(fullGame.descriptionRaw, game.id);
        }
      }
    } catch {}
    setModalLoading(false);
  };

  const closeGame = () => {
    setSelectedGame(null);
    setDescriptionExpanded(false);
    setDescriptionRu(null);
    setComment('');
  };

  const setStatus = async (newStatus: 'want' | 'dropped' | 'none') => {
    if (!userId || !selectedGame) {
      showToast('Войди, чтобы сохранить', 'info');
      return;
    }
    setSavingStatus(true);

    if (newStatus === 'none') {
      await supabase
        .from('user_games')
        .delete()
        .eq('user_id', userId)
        .eq('game_id', selectedGame.id);
      setUserGames((prev) => {
        const m = new Map(prev);
        m.delete(selectedGame.id);
        return m;
      });
      setGameStatus('none');
      setSavingStatus(false);
      return;
    }

    await supabase.from('user_games').upsert(
      {
        user_id: userId,
        game_id: selectedGame.id,
        rating: 0,
        hours: 0,
        review: '',
        status: newStatus,
      },
      { onConflict: 'user_id,game_id' },
    );

    fetchRewards(userId).then((r) => {
      if (r) setProfile((prev) => ({ ...prev, xp: r.xp, coins: r.coins }));
    });

    setUserGames((prev) => {
      const m = new Map(prev);
      m.set(selectedGame.id, {
        rating: 0,
        hours: 0,
        review: '',
        status: newStatus,
        xp: 0,
      });
      return m;
    });
    setGameStatus(newStatus);
    showToast(
      newStatus === 'want' ? 'Добавлено в лист ожидания' : 'Отмечено как неинтересное',
      'success',
    );
    setSavingStatus(false);
  };

  const publishComment = async () => {
    if (!userId || !selectedGame) {
      showToast('Войди, чтобы оставить комментарий', 'info');
      return;
    }
    if (comment.trim().length < 5) {
      showToast('Минимум 5 символов', 'error');
      return;
    }
    setPublishing(true);
    try {
      const res = await authFetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          gameId: selectedGame.id,
          gameTitle: selectedGame.title,
          gameCover: selectedGame.cover,
          rating: null,
          text: comment.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      setComment('');
      setSavedTick((v) => v + 1);
      showToast('Комментарий опубликован', 'success');
    } catch {
      showToast('Не удалось опубликовать', 'error');
    }
    setPublishing(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-500" />
            Календарь релизов
          </h1>
          <p className="text-neutral-400">Скоро выходящие игры на ближайшие 6 месяцев</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <span className="ml-3 text-neutral-400">Загрузка релизов...</span>
          </div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-20 bg-neutral-900 rounded-xl border border-neutral-800">
            <Gamepad2 className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
            <p className="text-neutral-400">Пока нет данных о ближайших релизах</p>
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map(([month, list]) => (
              <section key={month}>
                <h2 className="text-lg font-semibold text-white mb-4 capitalize">
                  {month}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {list.map((game) => {
                    const data = userGames.get(game.id);
                    const isWaiting = data?.status === 'want';
                    const isNotInterested = data?.status === 'dropped';

                    return (
                      <div
                        key={game.id}
                        onClick={() => openGame(game)}
                        className="group cursor-pointer bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden hover:border-neutral-700 hover:-translate-y-1 transition-all duration-200 flex flex-col"
                      >
                        <div className="relative aspect-video bg-neutral-800">
                          {game.cover ? (
                            <Image
                              src={game.cover}
                              alt={game.title}
                              fill
                              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Gamepad2 className="w-8 h-8 text-neutral-600" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                          <div className="absolute top-2 right-2 bg-indigo-500 text-white text-xs font-bold px-2 py-1 rounded-lg">
                            {formatDay(game.released, game.year)}
                          </div>

                          {isWaiting && (
                            <div className="absolute top-2 left-2 bg-blue-500 rounded-full p-1.5 shadow-lg">
                              <Heart className="w-3 h-3 text-white fill-current" />
                            </div>
                          )}
                          {isNotInterested && (
                            <div className="absolute top-2 left-2 bg-neutral-600 rounded-full p-1.5 shadow-lg">
                              <XCircle className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>

                        <div className="p-3">
                          <h3 className="font-medium text-sm text-white line-clamp-2 mb-1">
                            {game.title}
                          </h3>
                          <div className="flex flex-wrap gap-1">
                            {game.genres?.slice(0, 2).map((g) => (
                              <span
                                key={g.id}
                                className="text-[10px] text-neutral-400 bg-neutral-800 px-1.5 py-0.5 rounded"
                              >
                                {g.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Модалка релиза */}
      {selectedGame && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start md:items-center justify-center p-0 md:p-4 overflow-y-auto"
          onClick={closeGame}
        >
          <div
            className="bg-neutral-900 md:rounded-2xl w-full md:max-w-4xl max-h-screen md:max-h-[90vh] overflow-y-auto relative shadow-2xl border-0 md:border border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeGame}
              className="fixed md:absolute top-3 right-3 w-10 h-10 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full flex items-center justify-center transition z-40"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {modalLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <span className="ml-3 text-neutral-400">Загрузка данных...</span>
              </div>
            ) : (
              <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
                <GameMediaCarousel game={selectedGame} />

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-indigo-500" />
                  <span className="text-neutral-300">Дата выхода:</span>
                  <span className="text-white font-medium">
                    {formatDay(selectedGame.released, selectedGame.year)}
                  </span>
                </div>

                {userId ? (
                  <div className="bg-neutral-800/70 rounded-xl p-3 md:p-4">
                    <div className="grid grid-cols-2 gap-2 md:gap-3">
                      <button
                        onClick={() => setStatus(gameStatus === 'want' ? 'none' : 'want')}
                        disabled={savingStatus}
                        className={`px-4 py-3 rounded-lg text-sm font-medium transition flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 disabled:opacity-50 ${
                          gameStatus === 'want'
                            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                            : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${gameStatus === 'want' ? 'fill-current' : ''}`} />
                        <span>{gameStatus === 'want' ? 'Жду ✓' : 'Жду'}</span>
                      </button>
                      <button
                        onClick={() => setStatus(gameStatus === 'dropped' ? 'none' : 'dropped')}
                        disabled={savingStatus}
                        className={`px-4 py-3 rounded-lg text-sm font-medium transition flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 disabled:opacity-50 ${
                          gameStatus === 'dropped'
                            ? 'bg-neutral-500 text-white shadow-lg shadow-neutral-500/20'
                            : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                        }`}
                      >
                        <XCircle className="w-4 h-4" />
                        <span>{gameStatus === 'dropped' ? 'Неинтересно ✓' : 'Неинтересно'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-neutral-800 rounded-xl p-4 text-center">
                    <Lock className="w-7 h-7 text-neutral-500 mx-auto mb-2" />
                    <p className="text-sm text-neutral-400 mb-3">
                      Войди, чтобы отметить игру
                    </p>
                    <Link
                      href="/auth"
                      className="inline-block px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition"
                    >
                      Войти
                    </Link>
                  </div>
                )}

                <div>
                  {translating ? (
                    <div className="flex items-center gap-3 p-3 md:p-4 bg-neutral-800 rounded-lg">
                      <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                      <div>
                        <div className="text-sm text-white font-medium">Переводим описание...</div>
                        <div className="text-xs text-neutral-400 mt-0.5">Google Translate</div>
                      </div>
                    </div>
                  ) : descriptionRu ? (
                    <div>
                      {descriptionExpanded ? (
                        <div>
                          <p className="text-neutral-300 leading-relaxed text-sm md:text-base">
                            {descriptionRu}
                          </p>
                          <button
                            onClick={() => setDescriptionExpanded(false)}
                            className="mt-2 text-sm text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1"
                          >
                            Свернуть
                            <ChevronUp className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <p className="text-neutral-300 leading-relaxed line-clamp-4 text-sm md:text-base">
                            {descriptionRu}
                          </p>
                          {descriptionRu.length > 300 && (
                            <button
                              onClick={() => setDescriptionExpanded(true)}
                              className="mt-2 text-sm text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1"
                            >
                              Читать полностью
                              <ChevronDown className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-neutral-400 leading-relaxed mb-3 line-clamp-3 text-sm md:text-base">
                        {selectedGame.description}
                      </p>
                      {selectedGame?.descriptionRaw && (
                        <button
                          onClick={() =>
                            translateDescription(
                              selectedGame.descriptionRaw!,
                              selectedGame.id,
                            )
                          }
                          className="text-sm text-indigo-400 hover:text-indigo-300 transition"
                        >
                          Перевести на русский
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {selectedGame.platforms.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                      Платформы
                    </h3>
                    <div className="flex gap-1.5 flex-wrap">
                      {selectedGame.platforms.map((platform) => (
                        <div
                          key={platform}
                          className="px-2.5 py-1 bg-neutral-800 rounded-lg text-xs text-neutral-300"
                        >
                          {platform}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {userId && (
                  <div className="bg-neutral-800 rounded-xl p-4 md:p-5">
                    <h3 className="font-semibold text-white text-sm md:text-base mb-3 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-indigo-500" />
                      Твой комментарий
                    </h3>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Что думаешь об этой игре? Ждёшь её?"
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-white placeholder:text-neutral-500 min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                    {comment.length > 0 && (
                      <div className="mt-1.5 text-right">
                        <span className="text-xs text-neutral-500">
                          {comment.length} символов
                        </span>
                      </div>
                    )}
                    <button
                      onClick={publishComment}
                      disabled={publishing || comment.trim().length < 5}
                      className="mt-3 w-full px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {publishing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <MessageSquare className="w-4 h-4" />
                      )}
                      Оставить комментарий
                    </button>
                  </div>
                )}

                <div className="pt-4 border-t border-neutral-800">
                  <ReviewsSection
                    gameId={selectedGame.id}
                    title="Комментарии"
                    emptyText="Пока нет комментариев"
                    emptyHint="Стань первым — оставь комментарий выше"
                    refreshKey={savedTick}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}