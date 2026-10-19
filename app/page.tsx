'use client';

import { authFetch } from '@/lib/api-client';
import {
  X, Clock, MessageSquare, Trophy, TrendingUp,
  Zap, Loader2, Lock, Check, Heart, Gamepad, Save,
  ChevronDown, ChevronUp, XCircle, Compass, Tag, ArrowUpDown,
} from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Game, GameData } from '@/types/game';
import { cleanDescription } from '@/lib/text';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { getRatingColor, getSliderColor } from '@/lib/utils';
import { fetchRewards, describeGain } from '@/lib/rewards';
import GameCard from '@/components/GameCard';
import GameCardSkeleton from '@/components/GameCardSkeleton';
import ForYou from '@/components/ForYou';
import ReleasesTicker from '@/components/ReleasesTicker';
import SteamHero from '@/components/SteamHero';
import GenreTiles from '@/components/GenreTiles';
import HomeWelcome from '@/components/HomeWelcome';
import GameMediaCarousel from '@/components/GameMediaCarousel';
import SteamRating from '@/components/SteamRating';
import GameSeries from '@/components/GameSeries';
import GamePersonalFields from '@/components/GamePersonalFields';
import ReviewComposer from '@/components/ReviewComposer';
import ShareButton from '@/components/ShareButton';
import { emptyAspects, hasAspects, aspectColumns, aspectsFromRow, type Aspects } from '@/lib/aspects';
import GameMeta from '@/components/GameMeta';
import AdminEditButton from '@/components/AdminEditButton';
import TimeToBeat from '@/components/TimeToBeat';
import CreateGameModal from '@/components/CreateGameModal';
import ScreenshotViewer from '@/components/ScreenshotViewer';
import ReviewsSection from '@/components/ReviewsSection';
import { useGameUpdates, patchGameInList } from '@/lib/game-events';

type ActivityType = 'added' | 'started' | 'completed' | 'dropped' | 'rated' | 'reviewed';

// Жанры — по slug (в /api/games они сопоставляются с жанрами IGDB)
const genres = [
  { id: '', name: 'Все жанры' },
  { id: 'action', name: 'Экшен' },
  { id: 'adventure', name: 'Приключения' },
  { id: 'role-playing-games-rpg', name: 'RPG' },
  { id: 'strategy', name: 'Стратегии' },
  { id: 'shooter', name: 'Шутеры' },
  { id: 'puzzle', name: 'Головоломки' },
  { id: 'racing', name: 'Гонки' },
  { id: 'sports', name: 'Спорт' },
  { id: 'simulation', name: 'Симуляторы' },
  { id: 'indie', name: 'Инди' },
];

const sortOptions = [
  { value: 'steam', label: 'Популярные в Steam' },
  { value: '-added', label: 'Популярные' },
  { value: '-rating', label: 'По рейтингу' },
  { value: '-released', label: 'Новинки' },
  { value: '-metacritic', label: 'Metacritic' },
];

export default function Home() {
  const { userId, userGames, setUserGames, setProfile, profile } = useAuth();
  const { showToast } = useToast();

  const [mounted, setMounted] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('steam');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [userRating, setUserRating] = useState(0);
  const [userAspects, setUserAspects] = useState<Aspects>(emptyAspects());
  const [userHours, setUserHours] = useState(0);
  const [review, setReview] = useState('');
  const [gameStatus, setGameStatus] = useState<'none' | 'want' | 'playing' | 'completed' | 'dropped'>('none');
  const [xpGain, setXpGain] = useState<number | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  useGameUpdates((g) => setGames((prev) => patchGameInList(prev, g)));
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  // Поиск без фильтров («показать все результаты»): старые и редкие игры, которые обычный поиск скрывает
  const [searchAll, setSearchAll] = useState(false);
  // Создание своей карточки игры
  const [createOpen, setCreateOpen] = useState(false);
  const openCreate = () => {
    if (!userId) {
      showToast('Войди, чтобы создавать карточки', 'info');
      return;
    }
    setCreateOpen(true);
  };
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [descriptionRu, setDescriptionRu] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(0);
  const [saving, setSaving] = useState(false);

  const searchMode = searchQuery ? 'results' : 'browse';

  // Защита от гонок: поздний ответ каталога не должен затирать результаты поиска (и наоборот)
  const requestRef = useRef(0);
  const searchActiveRef = useRef(false);

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
      const myReq = ++requestRef.current;
      const stale = () => myReq !== requestRef.current;
      setLoading(true);
      try {
        const g = genre !== undefined ? genre : selectedGenre;
        const s = sort !== undefined ? sort : sortBy;

        // Популярные в Steam за всё время (по жанру, если выбран) — листается дальше
        if (s === 'steam') {
          try {
            const res = await fetch(
              `/api/steam/genre?page=${pageNum}${g ? `&genre=${encodeURIComponent(g)}` : ''}`,
            ).then((r) => r.json());
            if (stale()) return;
            const fromApi: Game[] = (res.results || []) as Game[];
            if (fromApi.length > 0) {
              setGames((prev) => {
                const base = append ? prev : [];
                const seen = new Set(base.map((x) => x.id));
                return [...base, ...fromApi.filter((x) => !seen.has(x.id))];
              });
              setHasMore(!!res.next);
              setLoading(false);
              return;
            }
          } catch {
            // упадём в запасной вариант ниже
          }
        }
        // Запасной вариант, если Steam не ответил: обычный каталог по популярности
        const ord = s === 'steam' ? '-added' : s;
        let url = `/api/games?page=${pageNum}&pageSize=20&ordering=${ord}`;
        if (g) url += `&genres=${g}`;
        const response = await fetch(url);
        const data = await response.json();
        if (stale()) return;
        if (data.results) {
          // /api/games уже возвращает готовые Game (IGDB внутри)
          const mappedGames = data.results;
          setGames((prev) => (append ? [...prev, ...mappedGames] : mappedGames));
          setHasMore(data.next !== null);
        }
      } catch (error) {
        console.error('Ошибка загрузки:', error);
        if (!stale()) showToast('Не удалось загрузить игры', 'error');
      }
      if (!stale()) setLoading(false);
    },
    [selectedGenre, sortBy, showToast],
  );

  const performSearch = useCallback(
    async (q: string, all = false) => {
      const myReq = ++requestRef.current;
      searchActiveRef.current = true;
      setSearchAll(all);
      setLoading(true);
      try {
        const res = await fetch(`/api/games/search?search=${encodeURIComponent(q)}${all ? '&all=1' : ''}`);
        const data = await res.json();
        if (myReq !== requestRef.current) return;
        if (data.results) {
          // API уже возвращает готовые объекты Game (IGDB → mapIgdbGame внутри роута)
          setGames(data.results);
          setHasMore(false);
        }
      } catch (error) {
        console.error('Ошибка поиска:', error);
        if (myReq === requestRef.current) showToast('Ошибка поиска', 'error');
      }
      if (myReq === requestRef.current) setLoading(false);
    },
    [showToast],
  );

  const openedGameRequest = useRef(0);
  const openGame = async (game: Game) => {
    const request = ++openedGameRequest.current;
    setSelectedGame(game);
    setDescriptionExpanded(false);
    setTranslating(false);
    setDescriptionRu(null);
    setSelectedScreenshot(null);
    setSaving(false);

    const cached = userGames.get(game.id);
    if (cached) {
      setUserRating(cached.rating || 0);
      setUserAspects(cached.aspects || emptyAspects());
      setUserHours(cached.hours || 0);
      setReview(cached.review || '');
      setGameStatus(cached.status || 'none');
    } else {
      setUserAspects(emptyAspects());
      setUserRating(0);
      setUserHours(0);
      setReview('');
      setGameStatus('none');
    }

    // Свежие данные пользователя — async IIFE, чтобы типобезопасно
    if (userId) {
      (async () => {
        try {
          const { data } = await supabase
            .from('user_games')
            .select('rating, hours, review, status, rate_gameplay, rate_story, rate_visuals, rate_music')
            .eq('user_id', userId)
            .eq('game_id', game.id)
            .maybeSingle();
          if (data && request === openedGameRequest.current) {
            setUserRating(data.rating || 0);
            setUserAspects(aspectsFromRow(data));
            setUserHours(data.hours || 0);
            setReview(data.review || '');
            setGameStatus(data.status || 'none');
          }
        } catch {
          // молча
        }
      })();
    }

fetch(`/api/games/${game.id}?full=true`)
      .then((r) => (r.ok ? r.json() : null))
      .then((fullGame) => {
        if (!fullGame || request !== openedGameRequest.current) return;
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
        searchActiveRef.current = false;
        setSearchQuery('');
        setPage(1);
        loadGames(1, false, '', 'steam');
      }
    };
    window.addEventListener('playlog:search', handler);

    const pending = sessionStorage.getItem('pendingSearch');
    if (pending) {
      sessionStorage.removeItem('pendingSearch');
      searchActiveRef.current = true;
      setSearchQuery(pending);
      performSearch(pending);
    } else {
      loadGames(1, false, '', 'steam');
    }

    return () => window.removeEventListener('playlog:search', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openGameRef = useRef(openGame);
  openGameRef.current = openGame;

  useEffect(() => {
    const openHandler = (e: Event) => {
      const game = (e as CustomEvent).detail?.game;
      if (game) openGameRef.current(game);
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
          .then((game) => { if (game) openGameRef.current(game); })
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
    if (userId && selectedGame) void openGameRef.current(selectedGame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (searchMode === 'browse' && !searchQuery && !searchActiveRef.current) {
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

  // XP и монеты начисляет сервер (триггер в базе). Здесь только обновляем показанные значения.
  const syncRewards = async () => {
    if (!userId) return;
    const r = await fetchRewards(userId);
    if (!r) return;
    const gain = r.xp - profile.xp;
    const coinGain = r.coins - (profile.coins || 0);
    setProfile((prev) => ({ ...prev, xp: r.xp, coins: r.coins }));
    if (gain > 0) {
      setXpGain(gain);
      setTimeout(() => setXpGain(null), 2000);
    }
    const text = describeGain(gain, coinGain);
    if (text) showToast(text, 'success');
  };

  const logActivity = (
    type: ActivityType,
    game: Game,
    extras: { hours?: number; rating?: number; preview?: string } = {},
  ) => {
    if (!userId) return;
    authFetch('/api/activity', {
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

  const translateDescription = async (rawText: string, gameId: number) => {
    const request = openedGameRequest.current;
    const text = cleanDescription(rawText);
    const cached = localStorage.getItem(`translation_${gameId}`);
    if (cached) {
      setDescriptionRu(cleanDescription(cached));
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
      if (request !== openedGameRequest.current) return;
      if (data.translatedText) {
        setDescriptionRu(data.translatedText);
        localStorage.setItem(`translation_${gameId}`, data.translatedText);
      } else {
        setDescriptionRu(text);
      }
    } catch {
      if (request === openedGameRequest.current) setDescriptionRu(text);
    }
    if (request === openedGameRequest.current) setTranslating(false);
  };

  const closeGame = () => {
    openedGameRequest.current++;
    setSelectedGame(null);
    setDescriptionExpanded(false);
    setDescriptionRu(null);
    setSelectedScreenshot(null);
    setSaving(false);
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
      aspects: userAspects,
    };
    if (!selectedGame || !userId) return newData;
    // Колонки аспектов пишем, только если они есть/были: сохранение не зависит от SQL, пока аспекты не используются
    const hadAspects = hasAspects(userGames.get(selectedGame.id)?.aspects);
    const aspectPart = hasAspects(userAspects) || hadAspects ? aspectColumns(userAspects) : {};

    const { error: saveError } = await supabase.from('user_games').upsert(
      {
        user_id: userId,
        game_id: selectedGame.id,
        rating: newRating,
        hours: newHours,
        review: newReview,
        status: newStatus,
        ...aspectPart,
      },
      { onConflict: 'user_id,game_id' },
    );

    if (saveError) throw saveError;

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
      await saveData(userRating, userHours, review, gameStatus);

      await syncRewards();

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
      const response = await authFetch('/api/reviews', {
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
      if (!response.ok) throw new Error('Publish failed');
      setSavedTick((v) => v + 1);
      logActivity('reviewed', gameRef, {
        rating: userRating > 0 ? userRating : undefined,
        preview: review.trim().slice(0, 120),
      });
      showToast('Рецензия опубликована', 'success');
      return true;
    } catch {
      showToast('Не удалось опубликовать', 'error');
      return false;
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadGames(nextPage, true, selectedGenre, sortBy);
  };

  const handleReset = () => {
    searchActiveRef.current = false;
    setSearchQuery('');
    setSelectedGenre('');
    setPage(1);
    window.dispatchEvent(new CustomEvent('playlog:search', { detail: { query: '' } }));
    loadGames(1, false, '', 'steam');
  };

  const gameModal = selectedGame ? (
    <div
      className="fixed inset-0 bg-black z-[9999] overflow-y-auto"
      onClick={closeGame}
    >
      <div className="min-h-full flex items-start md:items-center justify-center p-0 md:p-4">
        <div
          className="bg-neutral-900 md:rounded-2xl w-full md:max-w-4xl max-h-screen md:max-h-[90vh] overflow-y-auto relative shadow-2xl border-0 md:border border-neutral-800"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={closeGame}
            className="fixed md:absolute top-[calc(0.75rem+env(safe-area-inset-top))] md:top-3 right-3 w-10 h-10 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full flex items-center justify-center transition z-40"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top))] md:p-6 lg:p-8 space-y-3 md:space-y-4">
            <GameMediaCarousel
              game={selectedGame}
              onScreenshotClick={setSelectedScreenshot}
              steamBadge={<SteamRating gameTitle={selectedGame.title} variant="badge" />}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ShareButton key={selectedGame.id} path={`/?open=${selectedGame.id}`} title={selectedGame.title} />
              <AdminEditButton game={selectedGame} userId={userId} onSaved={(g) => setSelectedGame(g)} />
            </div>

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
                    <div className="text-sm text-white font-medium"></div>
                    <div className="text-xs text-neutral-400 mt-0.5"></div>
                  </div>
                </div>
              ) : descriptionRu ? (
                <div>
                  {descriptionExpanded ? (
                    <div>
                      <p className="whitespace-pre-line text-neutral-300 leading-relaxed text-sm md:text-base">
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
                      <p className="whitespace-pre-line text-neutral-300 leading-relaxed line-clamp-4 text-sm md:text-base">
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
                  <p className="whitespace-pre-line text-neutral-400 leading-relaxed mb-3 line-clamp-3 text-sm md:text-base">
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

            <GameMeta gameId={selectedGame.id} platforms={selectedGame.platforms} />



            {userId && (
              <>
                <GamePersonalFields gameId={selectedGame.id} playtime={selectedGame.playtime} rating={userRating} hours={userHours} aspects={userAspects} onRating={setUserRating} onHours={setUserHours} onAspects={setUserAspects} />
                <ReviewComposer key={selectedGame.id} value={review} onChange={setReview} onPublish={publishReview} />

                <div className="flex gap-2 sticky bottom-0 z-30 -mx-4 px-4 py-3 bg-neutral-900/95 backdrop-blur border-t border-neutral-800 md:static md:mx-0 md:px-0 md:pb-0 md:pt-3 md:bg-transparent md:backdrop-blur-none">
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

            <GameSeries gameId={selectedGame.id} onOpen={openGame} />

            <div className="pt-4 border-t border-neutral-800">
              <ReviewsSection gameId={selectedGame.id} refreshKey={savedTick} />
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const screenshotModal = selectedScreenshot ? (
    <ScreenshotViewer
      images={(selectedGame?.screenshots || []).map((x) => x.image)}
      current={selectedScreenshot}
      onChange={setSelectedScreenshot}
      onClose={() => setSelectedScreenshot(null)}
    />
  ) : null;

  const createModal =
    createOpen && userId ? (
      <CreateGameModal
        userId={userId}
        initialTitle={searchQuery}
        onClose={() => setCreateOpen(false)}
        onCreated={(game) => {
          setCreateOpen(false);
          setGames((prev) => [game, ...prev.filter((g) => g.id !== game.id)]);
          showToast('Карточка создана. Другие пользователи увидят её после одобрения', 'success');
          openGame(game);
        }}
      />
    ) : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {xpGain && (
        <div className="fixed top-[calc(5rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium z-50 shadow-lg animate-bounce">
          <Zap className="w-4 h-4 inline mr-1" /> +{xpGain} XP!
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <main className="space-y-7 md:space-y-10">
          {searchMode === 'browse' && (
            <>
              <HomeWelcome />
              <SteamHero onGameClick={openGame} />
              <ForYou onGameClick={openGame} />
              <GenreTiles
                selected={selectedGenre}
                onPick={(id) => {
                  setSelectedGenre(id);
                  setTimeout(
                    () => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                    50,
                  );
                }}
              />
              <ReleasesTicker />
            </>
          )}

          <div id="catalog" className="scroll-mt-20">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-500" />
                {searchMode === 'results'
                  ? `Результаты: "${searchQuery}"`
                  : sortBy === 'steam'
                    ? selectedGenre
                      ? `Популярные в Steam: ${genres.find((x) => x.id === selectedGenre)?.name || ''}`
                      : 'Популярные в Steam'
                    : 'Каталог игр'}
              </h2>

              {searchMode === 'browse' && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-none">
                    <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none z-10" />
                    <select
                      value={selectedGenre}
                      onChange={(e) => setSelectedGenre(e.target.value)}
                      className="w-full appearance-none bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-lg pl-8 pr-7 py-2 sm:py-1.5 text-xs md:text-sm font-medium text-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer transition"
                    >
                      {genres.map((g) => (
                        <option key={g.id} value={g.id} className="bg-neutral-900">
                          {g.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500 pointer-events-none" />
                  </div>

                  <div className="relative flex-1 sm:flex-none">
                    <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none z-10" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full appearance-none bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-lg pl-8 pr-7 py-2 sm:py-1.5 text-xs md:text-sm font-medium text-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer transition"
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
                  {searchMode === 'results' && !searchAll
                    ? 'Старые и редкие игры обычный поиск скрывает — попробуй показать все результаты'
                    : 'Попробуй изменить фильтры или поискать другой жанр'}
                </p>
                {searchMode === 'results' && !searchAll && (
                  <button
                    onClick={() => performSearch(searchQuery, true)}
                    className="inline-block mb-3 mr-2 px-6 py-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white font-medium rounded-lg transition"
                  >
                    Показать все результаты
                  </button>
                )}
                {searchMode === 'results' && (
                  <button
                    onClick={openCreate}
                    className="inline-block mb-3 mr-2 px-6 py-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white font-medium rounded-lg transition"
                  >
                    Создать карточку самому
                  </button>
                )}
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
                {searchMode === 'results' && (
                  <div className="text-center mt-8">
                    <p className="text-sm text-neutral-500 mb-3">Нет нужной игры?</p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {!searchAll && (
                        <button
                          onClick={() => performSearch(searchQuery, true)}
                          disabled={loading}
                          className="px-6 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-sm font-medium text-neutral-300 hover:bg-neutral-800 disabled:opacity-50 transition"
                        >
                          Показать все результаты
                        </button>
                      )}
                      <button
                        onClick={openCreate}
                        className="px-6 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-sm font-medium text-neutral-300 hover:bg-neutral-800 transition"
                      >
                        Создать карточку самому
                      </button>
                    </div>
                  </div>
                )}
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
      {mounted && createModal ? createPortal(createModal, document.body) : null}
    </div>
  );
}
