'use client';

import {
  X, Clock, MessageSquare, Trophy, TrendingUp,
  Zap, Loader2, Lock, Check, Heart, Gamepad, Save,
  ChevronDown, ChevronUp, XCircle, Compass, Tag, ArrowUpDown,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Game, GameData } from '@/types/game';
import { mapRawgGame, RawgGame } from '@/lib/rawg';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { getRatingColor, getSliderColor } from '@/lib/utils';
import { calculateXpGain, calculateCoinGain } from '@/lib/xp';
import GameCard from '@/components/GameCard';
import GameCardSkeleton from '@/components/GameCardSkeleton';
import ForYou from '@/components/ForYou';
import ReleasesTicker from '@/components/ReleasesTicker';
import GameMediaCarousel from '@/components/GameMediaCarousel';
import SteamRating from '@/components/SteamRating';
import ReviewsSection from '@/components/ReviewsSection';

type ActivityType = 'added' | 'started' | 'completed' | 'dropped' | 'rated' | 'reviewed';

const genres = [
  { id: '', name: 'Все жанры' },
  { id: '4', name: 'Action' },
  { id: '3', name: 'Adventure' },
  { id: '5', name: 'RPG' },
  { id: '2', name: 'Strategy' },
  { id: '1', name: 'Shooter' },
  { id: '7', name: 'Puzzle' },
  { id: '10', name: 'Racing' },
  { id: '11', name: 'Sports' },
  { id: '40', name: 'Indie' },
];

const sortOptions = [
  { value: '-added', label: 'Популярные' },
  { value: '-rating', label: 'По рейтингу' },
  { value: '-released', label: 'Новинки' },
  { value: '-metacritic', label: 'Metacritic' },
];

export default function Home() {
  const { userId, userGames, setUserGames, setProfile } = useAuth();
  const { showToast } = useToast();

  const [mounted, setMounted] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('-added');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [userRating, setUserRating] = useState(0);
  const [userHours, setUserHours] = useState(0);
  const [review, setReview] = useState('');
  const [gameStatus, setGameStatus] = useState<'none' | 'want' | 'playing' | 'completed' | 'dropped'>('none');
  const [xpGain, setXpGain] = useState<number | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [descriptionRu, setDescriptionRu] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(0);
  const [saving, setSaving] = useState(false);

  const searchMode = searchQuery ? 'results' : 'browse';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!selectedGame && !selectedScreenshot) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [selectedGame, selectedScreenshot]);

  const loadGames = useCallback(
    async (pageNum: number, append: boolean = false, genre?: string, sort?: string) => {
      setLoading(true);
      try {
        const g = genre !== undefined ? genre : selectedGenre;
        const s = sort !== undefined ? sort : sortBy;
        let url = `/api/games?page=${pageNum}&pageSize=20&ordering=${s}`;
        if (g) url += `&genres=${g}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.results) {
          const mappedGames = data.results.map((g: RawgGame) => mapRawgGame(g));
          setGames((prev) => (append ? [...prev, ...mappedGames] : mappedGames));
          setHasMore(data.next !== null);
        }
      } catch (error) {
        console.error('Ошибка загрузки:', error);
        showToast('Не удалось загрузить игры', 'error');
      }
      setLoading(false);
    },
    [selectedGenre, sortBy, showToast],
  );

  const performSearch = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/games/search?search=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data.results) {
          setGames(data.results.map((g: RawgGame) => mapRawgGame(g)));
          setHasMore(false);
        }
      } catch (error) {
        console.error('Ошибка поиска:', error);
        showToast('Ошибка поиска', 'error');
      }
      setLoading(false);
    },
    [showToast],
  );

  const openGame = async (game: Game) => {
    setSelectedGame(game);
    setDescriptionExpanded(false);
    setTranslating(false);
    setDescriptionRu(null);
    setSelectedScreenshot(null);
    setSaving(false);

    const cached = userGames.get(game.id);
    if (cached) {
      setUserRating(cached.rating || 0);
      setUserHours(cached.hours || 0);
      setReview(cached.review || '');
      setGameStatus(cached.status || 'none');
    } else {
      setUserRating(0);
      setUserHours(0);
      setReview('');
      setGameStatus('none');
    }

    if (userId) {
      supabase
        .from('user_games')
        .select('rating, hours, review, status')
        .eq('user_id', userId)
        .eq('game_id', game.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setUserRating(data.rating || 0);
            setUserHours(data.hours || 0);
            setReview(data.review || '');
            setGameStatus(data.status || 'none');
          }
        })
        .catch(() => {});
    }

    fetch(`/api/games/${game.id}?full=true`)
      .then((r) => (r.ok ? r.json() : null))
      .then((rawData) => {
        if (!rawData) return;
        const fullGame = mapRawgGame(rawData);
        setSelectedGame(fullGame);
        if (fullGame.descriptionRaw) {
          translateDescription(fullGame.descriptionRaw, game.id);
        }
      })
      .catch((err) => console.error('Ошибка загрузки полных данных:', err));
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const q = (e as CustomEvent).detail?.query || '';
      if (q) {
        setSearchQuery(q);
        setPage(1);
        performSearch(q);
      } else {
        setSearchQuery('');
        setPage(1);
        loadGames(1, false, '', '-added');
      }
    };
    window.addEventListener('playlog:search', handler);

    const pending = sessionStorage.getItem('pendingSearch');
    if (pending) {
      sessionStorage.removeItem('pendingSearch');
      setSearchQuery(pending);
      performSearch(pending);
    } else {
      loadGames(1, false, '', '-added');
    }

    return () => window.removeEventListener('playlog:search', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const openHandler = (e: Event) => {
      const game = (e as CustomEvent).detail?.game;
      if (game) openGame(game);
    };
    window.addEventListener('playlog:openGame', openHandler);

    const urlParams = new URLSearchParams(window.location.search);
    const openId = urlParams.get('open');

    if (openId) {
      const gameId = Number(openId);
      if (!isNaN(gameId)) {
        window.history.replaceState({}, '', '/');
        fetch(`/api/games/${gameId}?full=true`)
          .then((r) => (r.ok ? r.json() : null))
          .then((rawData) => {
            if (!rawData) return;
            const game = mapRawgGame(rawData);
            setSelectedGame(game);

            const data = userGames.get(gameId);
            if (data) {
              setUserRating(data.rating || 0);
              setUserHours(data.hours || 0);
              setReview(data.review || '');
              setGameStatus(data.status || 'none');
            }
            if (game.descriptionRaw) {
              translateDescription(game.descriptionRaw, gameId);
            }
          })
          .catch((err) => console.error('Open from URL error:', err));
      }
    } else {
      const pendingGame = sessionStorage.getItem('pendingOpenGame');
      if (pendingGame) {
        sessionStorage.removeItem('pendingOpenGame');
        try {
          const game: Game = JSON.parse(pendingGame);
          setTimeout(() => openGame(game), 100);
        } catch (err) {
          console.error('Pending open game parse error:', err);
        }
      }
    }

    return () => window.removeEventListener('playlog:openGame', openHandler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (searchMode === 'browse' && !searchQuery) {
      loadGames(1, false, selectedGenre, sortBy);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGenre, sortBy]);

  useEffect(() => {
    if (!selectedGame) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedScreenshot) {
          setSelectedScreenshot(null);
        } else {
          closeGame();
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [selectedGame, selectedScreenshot]);

  // === Начисление XP + монет ===
  const addRewards = async (xpAmount: number, coinsAmount: number) => {
    if (xpAmount > 0) {
      setProfile((prev) => ({ ...prev, xp: prev.xp + xpAmount }));
      setXpGain(xpAmount);
      setTimeout(() => setXpGain(null), 2000);
    }
    if (!userId) return;

    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('xp, coins')
      .eq('id', userId)
      .single();

    if (!currentProfile) return;

    const patch: { xp?: number; coins?: number } = {};
    if (xpAmount > 0) patch.xp = (currentProfile.xp || 0) + xpAmount;
    if (coinsAmount > 0) {
      patch.coins = (currentProfile.coins || 0) + coinsAmount;
      setProfile((prev) => ({ ...prev, coins: (prev.coins || 0) + coinsAmount }));
    }

    if (Object.keys(patch).length > 0) {
      await supabase.from('profiles').update(patch).eq('id', userId);
    }
  };

  const logActivity = (
    type: ActivityType,
    game: Game,
    extras: { hours?: number; rating?: number; preview?: string } = {},
  ) => {
    if (!userId) return;
    fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        type,
        gameId: game.id,
        gameTitle: game.title,
        gameCover: game.cover,
        hours: extras.hours || 0,
        rating: extras.rating ?? null,
        preview: extras.preview || null,
      }),
    }).catch(() => {});
  };

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

  const closeGame = () => {
    setSelectedGame(null);
    setDescriptionExpanded(false);
    setDescriptionRu(null);
    setSelectedScreenshot(null);
    setSaving(false);
  };

  const publishReviewInBackground = (
    game: Game,
    rating: number,
    text: string,
  ) => {
    if (!userId || text.trim().length < 20) return;
    fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        gameId: game.id,
        gameTitle: game.title,
        gameCover: game.cover,
        rating: rating > 0 ? rating : null,
        text: text.trim(),
      }),
    })
      .then(() => {
        setSavedTick((v) => v + 1);
        logActivity('reviewed', game, {
          rating: rating > 0 ? rating : undefined,
          preview: text.trim().slice(0, 120),
        });
      })
      .catch(() => {});
  };

  const saveData = async (
    newRating: number,
    newHours: number,
    newReview: string,
    newStatus: 'none' | 'want' | 'playing' | 'completed' | 'dropped',
  ): Promise<GameData> => {
    const newData: GameData = {
      rating: newRating,
      hours: newHours,
      review: newReview,
      status: newStatus,
      xp: 0,
    };
    if (!selectedGame || !userId) return newData;

    await supabase.from('user_games').upsert(
      {
        user_id: userId,
        game_id: selectedGame.id,
        rating: newRating,
        hours: newHours,
        review: newReview,
        status: newStatus,
      },
      { onConflict: 'user_id,game_id' },
    );

    setUserGames((prev) => {
      const newMap = new Map(prev);
      newMap.set(selectedGame.id, newData);
      return newMap;
    });

    return newData;
  };

  const saveAndClose = async () => {
    if (!selectedGame || saving) return;
    setSaving(true);

    try {
      const oldData = userGames.get(selectedGame.id) || null;
      const gameRef = selectedGame;
      const newData = await saveData(userRating, userHours, review, gameStatus);

      const { amount: xpAmount } = calculateXpGain(oldData, newData);
      const coinsAmount = calculateCoinGain(oldData, newData);
      if (xpAmount > 0 || coinsAmount > 0) addRewards(xpAmount, coinsAmount);

      const oldStatus = oldData?.status || 'none';
      const oldRating = oldData?.rating || 0;

      if (!oldData && gameStatus !== 'none') {
        logActivity('added', gameRef, { hours: userHours });
      } else if (oldStatus !== gameStatus) {
        if (gameStatus === 'playing') {
          logActivity('started', gameRef, { hours: userHours });
        } else if (gameStatus === 'completed') {
          logActivity('completed', gameRef, { hours: userHours });
        } else if (gameStatus === 'dropped') {
          logActivity('dropped', gameRef, { hours: userHours });
        } else if (gameStatus === 'want' && oldStatus === 'none') {
          logActivity('added', gameRef);
        }
      }

      if (userRating > 0 && userRating !== oldRating) {
        logActivity('rated', gameRef, { rating: userRating });
      }

      showToast('Сохранено', 'success');
      closeGame();

      if (review.trim().length >= 20) {
        publishReviewInBackground(gameRef, userRating, review);
      }
    } catch (err) {
      console.error('Save error:', err);
      showToast('Не удалось сохранить', 'error');
      setSaving(false);
    }
  };

  const publishReview = async () => {
    if (!userId || !selectedGame) return;
    if (review.trim().length < 20) {
      showToast('Минимум 20 символов для публикации', 'error');
      return;
    }
    try {
      const gameRef = selectedGame;
      await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          gameId: gameRef.id,
          gameTitle: gameRef.title,
          gameCover: gameRef.cover,
          rating: userRating > 0 ? userRating : null,
          text: review.trim(),
        }),
      });
      setSavedTick((v) => v + 1);
      logActivity('reviewed', gameRef, {
        rating: userRating > 0 ? userRating : undefined,
        preview: review.trim().slice(0, 120),
      });
      showToast('Рецензия опубликована', 'success');
    } catch {
      showToast('Не удалось опубликовать', 'error');
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadGames(nextPage, true, selectedGenre, sortBy);
  };

  const handleReset = () => {
    setSearchQuery('');
    setSelectedGenre('');
    setPage(1);
    window.dispatchEvent(new CustomEvent('playlog:search', { detail: { query: '' } }));
    loadGames(1, false, '', '-added');
  };

  const gameModal = selectedGame ? (
    <div
      className="fixed inset-0 bg-black z-[9999] overflow-y-auto"
      onClick={closeGame}
    >
      <div className="min-h-full flex items-start md:items-center justify-center p-0 md:p-4">
        <div
          className="bg-neutral-900 md:rounded-2xl w-full md:max-w-4xl md:max-h-[90vh] overflow-y-auto relative shadow-2xl border-0 md:border border-neutral-800"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={closeGame}
            className="absolute top-3 right-3 w-10 h-10 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full flex items-center justify-center transition z-40"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
            <GameMediaCarousel
              game={selectedGame}
              onScreenshotClick={setSelectedScreenshot}
              steamBadge={<SteamRating gameTitle={selectedGame.title} variant="badge" />}
            />

            {userId ? (
              <div className="bg-neutral-800/70 rounded-xl p-3 md:p-4">
                <div className="grid grid-cols-4 gap-1.5 md:gap-2">
                  <button
                    onClick={() => setGameStatus('want')}
                    className={`px-2 py-2.5 md:py-3 rounded-lg text-xs md:text-sm font-medium transition flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 ${
                      gameStatus === 'want'
                        ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                        : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    <Heart className="w-4 h-4" />
                    <span>Хочу</span>
                  </button>
                  <button
                    onClick={() => setGameStatus('playing')}
                    className={`px-2 py-2.5 md:py-3 rounded-lg text-xs md:text-sm font-medium transition flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 ${
                      gameStatus === 'playing'
                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                        : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    <Gamepad className="w-4 h-4" />
                    <span>Играю</span>
                  </button>
                  <button
                    onClick={() => setGameStatus('completed')}
                    className={`px-2 py-2.5 md:py-3 rounded-lg text-xs md:text-sm font-medium transition flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 ${
                      gameStatus === 'completed'
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                        : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>Прошёл</span>
                  </button>
                  <button
                    onClick={() => setGameStatus('dropped')}
                    className={`px-2 py-2.5 md:py-3 rounded-lg text-xs md:text-sm font-medium transition flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 ${
                      gameStatus === 'dropped'
                        ? 'bg-neutral-500 text-white shadow-lg shadow-neutral-500/20'
                        : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Заброшено</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-neutral-800 rounded-xl p-4 text-center">
                <Lock className="w-7 h-7 text-neutral-500 mx-auto mb-2" />
                <p className="text-sm text-neutral-400 mb-3">
                  Войди, чтобы добавлять игры в список
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
              <>
                <div className="bg-neutral-800 rounded-xl p-4 md:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white text-sm md:text-base flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-indigo-500" />
                      Твоя оценка
                    </h3>
                    <span className={`text-xl md:text-2xl font-bold ${getRatingColor(userRating)}`}>
                      {userRating > 0 ? `${userRating}/10` : '—'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={userRating}
                    onChange={(e) => setUserRating(parseInt(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, ${getSliderColor(userRating)} 0%, ${getSliderColor(userRating)} ${userRating * 10}%, #404040 ${userRating * 10}%, #404040 100%)`,
                    }}
                  />
                  <div className="flex justify-between text-[10px] text-neutral-500 mt-2">
                    <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span>
                    <span>5</span><span>6</span><span>7</span><span>8</span><span>9</span>
                    <span>10</span>
                  </div>
                </div>

                <div className="bg-neutral-800 rounded-xl p-4 md:p-5">
                  <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                    <h3 className="font-semibold text-white text-sm md:text-base flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-500" />
                      Часов наиграно
                    </h3>
                    {selectedGame.playtime && (
                      <span className="text-[11px] text-neutral-400 bg-neutral-900/50 px-2 py-1 rounded-md border border-neutral-700">
                        ⏱ ~{selectedGame.playtime} ч. среднее
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={userHours === 0 ? '' : userHours}
                      onChange={(e) => {
                        const v = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                        setUserHours(v);
                      }}
                      className="w-24 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      placeholder="0"
                    />
                    <span className="text-sm text-neutral-400">часов</span>
                  </div>
                </div>

                <div className="bg-neutral-800 rounded-xl p-4 md:p-5">
                  <h3 className="font-semibold text-white text-sm md:text-base mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-500" />
                    Твоя рецензия
                  </h3>
                  <textarea
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    placeholder="Напиши своё мнение об игре..."
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-white placeholder:text-neutral-500 min-h-[80px] md:min-h-[100px] resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                  {review.length > 0 && (
                    <div className="mt-1.5 text-right">
                      <span className="text-xs text-neutral-500">{review.length} символов</span>
                    </div>
                  )}
                  <p className="text-[11px] text-neutral-500 mt-2">
                    Рецензии от 20 символов публикуются для всех игроков
                  </p>
                  <button
                    onClick={publishReview}
                    disabled={review.trim().length < 20}
                    className="mt-3 w-full px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Оставить рецензию
                  </button>
                </div>

                <div className="flex gap-2 pt-2 border-t border-neutral-800">
                  <button
                    onClick={saveAndClose}
                    disabled={saving}
                    className="flex-1 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition flex items-center justify-center gap-2 text-sm md:text-base"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Сохраняем...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Сохранить
                      </>
                    )}
                  </button>
                  <button
                    onClick={closeGame}
                    disabled={saving}
                    className="px-4 md:px-6 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-300 font-medium py-3 rounded-lg transition text-sm md:text-base"
                  >
                    Отмена
                  </button>
                </div>
              </>
            )}

            <div className="pt-4 border-t border-neutral-800">
              <ReviewsSection gameId={selectedGame.id} refreshKey={savedTick} />
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const screenshotModal = selectedScreenshot ? (
    <div
      className="fixed inset-0 bg-black/95 z-[10000] flex items-center justify-center p-4 cursor-pointer"
      onClick={() => setSelectedScreenshot(null)}
    >
      <button
        onClick={() => setSelectedScreenshot(null)}
        className="absolute top-4 right-4 w-12 h-12 bg-neutral-800 hover:bg-neutral-700 rounded-full flex items-center justify-center transition z-10"
      >
        <X className="w-6 h-6 text-white" />
      </button>
      <img
        src={selectedScreenshot}
        alt="Screenshot"
        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {xpGain && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium z-50 shadow-lg animate-bounce">
          <Zap className="w-4 h-4 inline mr-1" /> +{xpGain} XP!
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <main className="space-y-5 md:space-y-6">
          <ReleasesTicker />

          {searchMode === 'browse' && <ForYou onGameClick={openGame} />}

          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-500" />
                {searchMode === 'results' ? `Результаты: "${searchQuery}"` : 'Популярные игры'}
              </h2>

              {searchMode === 'browse' && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none z-10" />
                    <select
                      value={selectedGenre}
                      onChange={(e) => setSelectedGenre(e.target.value)}
                      className="appearance-none bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-lg pl-8 pr-7 py-1.5 text-xs md:text-sm font-medium text-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer transition"
                    >
                      {genres.map((g) => (
                        <option key={g.id} value={g.id} className="bg-neutral-900">
                          {g.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500 pointer-events-none" />
                  </div>

                  <div className="relative">
                    <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none z-10" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="appearance-none bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-lg pl-8 pr-7 py-1.5 text-xs md:text-sm font-medium text-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer transition"
                    >
                      {sortOptions.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-neutral-900">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500 pointer-events-none" />
                  </div>
                </div>
              )}
            </div>

            {loading && games.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <GameCardSkeleton key={i} />
                ))}
              </div>
            ) : games.length === 0 ? (
              <div className="text-center py-20 bg-neutral-900 rounded-xl border border-neutral-800">
                <Compass className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
                <p className="text-neutral-400 mb-2">Ничего не найдено</p>
                <p className="text-sm text-neutral-500 mb-6">
                  Попробуй изменить фильтры или поискать другой жанр
                </p>
                {(selectedGenre || searchMode === 'results') && (
                  <button
                    onClick={handleReset}
                    className="inline-block px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition"
                  >
                    Сбросить фильтры
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {games.map((game, idx) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      onClick={() => openGame(game)}
                      userGameData={userGames.get(game.id)}
                      isAuthenticated={!!userId}
                      index={idx}
                    />
                  ))}
                </div>
                {hasMore && searchMode === 'browse' && (
                  <div className="text-center mt-8">
                    <button
                      onClick={loadMore}
                      disabled={loading}
                      className="px-6 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-sm font-medium text-neutral-300 hover:bg-neutral-800 disabled:opacity-50 transition"
                    >
                      {loading ? 'Загрузка...' : 'Показать ещё'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {mounted && gameModal ? createPortal(gameModal, document.body) : null}
      {mounted && screenshotModal ? createPortal(screenshotModal, document.body) : null}
    </div>
  );
}