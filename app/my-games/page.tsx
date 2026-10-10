'use client';

import PageHeading from '@/components/PageHeading';
import SteamIcon from '@/components/SteamIcon';
import { fetchRewards, describeGain } from '@/lib/rewards';
import { fetchGamesByIds } from '@/lib/games-client';
import { authFetch } from '@/lib/api-client';
import { useState, useEffect, useMemo } from 'react';
import {
  Heart, Gamepad, Check, Trophy, Star, Clock,
  Loader2, Lock, X, MessageSquare, Trash2, AlertTriangle, XCircle,
  ChevronDown, ChevronUp, Compass, ArrowUpDown, Filter, Library,
} from 'lucide-react';
import Link from 'next/link';
import { Game, GameData } from '@/types/game';
import { mapRawgGame, RawgGame } from '@/lib/rawg';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { getRatingColor, getSliderColor } from '@/lib/utils';
import GameCard from '@/components/GameCard';
import GameCardSkeleton from '@/components/GameCardSkeleton';
import GameMediaCarousel from '@/components/GameMediaCarousel';
import SteamRating from '@/components/SteamRating';
import ReviewsSection from '@/components/ReviewsSection';
import SteamImportModal from '@/components/SteamImportModal';

type TabType = 'all' | 'want' | 'playing' | 'completed' | 'dropped';
type SortType = 'newest' | 'oldest' | 'no-rating' | 'hours-desc' | 'hours-asc';

const sortOptions: { value: SortType; label: string }[] = [
  { value: 'newest', label: 'Новое' },
  { value: 'oldest', label: 'Старое' },
  { value: 'no-rating', label: 'Без оценки' },
  { value: 'hours-desc', label: 'Часы ↓' },
  { value: 'hours-asc', label: 'Часы ↑' },
];

export default function MyGamesPage() {
  const { userId, userGames, setUserGames, setProfile, profile, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalRating, setModalRating] = useState(0);
  const [modalHours, setModalHours] = useState(0);
  const [modalReview, setModalReview] = useState('');
  const [modalStatus, setModalStatus] = useState<
    'none' | 'want' | 'playing' | 'completed' | 'dropped'
  >('none');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<SortType>('newest');
  const [descriptionRu, setDescriptionRu] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [savedTick, setSavedTick] = useState(0);
  const [steamImportOpen, setSteamImportOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    const ids = Array.from(userGames.keys());
    if (ids.length === 0) {
      setGames([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadGames = async () => {
      setLoading(true);
      try {
        const mapped = await fetchGamesByIds(ids);
        if (cancelled) return;
        setGames(mapped);
      } catch (error) {
        console.error('Ошибка загрузки игр:', error);
      }
      if (cancelled) return;
      setLoading(false);
    };

    loadGames();

    return () => {
      cancelled = true;
    };
  }, [authLoading, userGames]);

  useEffect(() => {
    if (!selectedGame) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedScreenshot) {
          setSelectedScreenshot(null);
        } else if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else {
          closeGame();
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [selectedGame, selectedScreenshot, showDeleteConfirm]);

  const loadFullGameData = async (game: Game): Promise<Game | null> => {
    try {
      const response = await fetch(`/api/games/${game.id}?full=true`);
      if (response.ok) {
        const data: RawgGame = await response.json();
        return mapRawgGame(data);
      }
    } catch (err) {
      console.error('Ошибка загрузки полных данных:', err);
    }
    return null;
  };

  const translateDescription = async (text: string, gameId: number) => {
    const cached = localStorage.getItem(`translation_${gameId}`);
    if (cached) {
      setDescriptionRu(cached);
      return;
    }
    if (/[\u0410-\u044F]/.test(text)) {
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
      } else if (data.error) {
        console.error('Translation error:', data.error);
        setDescriptionRu(text);
      }
    } catch (error) {
      console.error('Translation error:', error);
      setDescriptionRu(text);
    }
    setTranslating(false);
  };

  const getGameList = (status: 'want' | 'playing' | 'completed' | 'dropped') => {
    return games.filter((game) => {
      const data = userGames.get(game.id);
      return data?.status === status;
    });
  };

  const filteredGames = useMemo(() => {
    let filtered: Game[] = [];
    if (activeTab === 'all') {
      filtered = games;
    } else {
      filtered = getGameList(activeTab);
    }

    // Фильтр "Без оценки"
    if (sortBy === 'no-rating') {
      filtered = filtered.filter((game) => {
        const data = userGames.get(game.id);
        return (data?.rating || 0) === 0;
      });
    }

    // Сортировка
    filtered = [...filtered].sort((a, b) => {
      const dataA = userGames.get(a.id);
      const dataB = userGames.get(b.id);
      const hoursA = dataA?.hours || 0;
      const hoursB = dataB?.hours || 0;
      const updatedA = dataA?.updatedAt ? new Date(dataA.updatedAt).getTime() : 0;
      const updatedB = dataB?.updatedAt ? new Date(dataB.updatedAt).getTime() : 0;

      switch (sortBy) {
        case 'newest':
        case 'no-rating':
          return updatedB - updatedA;
        case 'oldest':
          return updatedA - updatedB;
        case 'hours-desc':
          return hoursB - hoursA;
        case 'hours-asc':
          return hoursA - hoursB;
        default:
          return updatedB - updatedA;
      }
    });

    return filtered;
  }, [activeTab, games, userGames, sortBy]);

  const stats = useMemo(() => {
    const completed = getGameList('completed');
    const playing = getGameList('playing');
    const want = getGameList('want');
    const dropped = getGameList('dropped');
    const totalHours = Array.from(userGames.values()).reduce(
      (sum, data) => sum + (data.hours || 0),
      0,
    );
    const ratedGames = Array.from(userGames.values()).filter((d) => d.rating > 0);
    const avgRating =
      ratedGames.length > 0
        ? (
            ratedGames.reduce((sum, data) => sum + data.rating, 0) / ratedGames.length
          ).toFixed(1)
        : '—';
    return {
      total: userGames.size,
      completed: completed.length,
      playing: playing.length,
      want: want.length,
      dropped: dropped.length,
      totalHours,
      avgRating,
    };
  }, [userGames, games]);

  const statusOptions: { id: TabType; label: string; count: number }[] = [
    { id: 'all', label: 'Все игры', count: stats.total },
    { id: 'want', label: 'Хочу пройти', count: stats.want },
    { id: 'playing', label: 'Играю', count: stats.playing },
    { id: 'completed', label: 'Пройдено', count: stats.completed },
    { id: 'dropped', label: 'Заброшено', count: stats.dropped },
  ];

  const openGame = async (game: Game) => {
    setSelectedGame(game);
    setModalLoading(true);
    setShowDeleteConfirm(false);
    setDescriptionExpanded(false);
    setDescriptionRu(null);
    setTranslating(false);
    setSelectedScreenshot(null);
    const data = userGames.get(game.id);
    if (data) {
      setModalRating(data.rating || 0);
      setModalHours(data.hours || 0);
      setModalReview(data.review || '');
      setModalStatus(data.status || 'none');
    } else {
      setModalRating(0);
      setModalHours(0);
      setModalReview('');
      setModalStatus('none');
    }
    const fullGame = await loadFullGameData(game);
    if (fullGame) {
      setSelectedGame(fullGame);
      if (fullGame.descriptionRaw) {
        translateDescription(fullGame.descriptionRaw, game.id);
      }
    }
    setModalLoading(false);
  };

  const closeGame = () => {
    setSelectedGame(null);
    setShowDeleteConfirm(false);
    setSelectedScreenshot(null);
    setDescriptionExpanded(false);
    setDescriptionRu(null);
    setTranslating(false);
  };

  const saveModalData = async () => {
    if (!selectedGame || !userId) return;

    // 1. Сохраняем в user_games — это быстро
    await supabase.from('user_games').upsert(
      {
        user_id: userId,
        game_id: selectedGame.id,
        rating: modalRating,
        hours: modalHours,
        review: modalReview,
        status: modalStatus,
      },
      { onConflict: 'user_id,game_id' },
    );

    // XP и монеты начисляет база данных — подтягиваем актуальные значения
    const prevXp = profile.xp;
    const prevCoins = profile.coins || 0;
    fetchRewards(userId).then((r) => {
      if (!r) return;
      setProfile((prev) => ({ ...prev, xp: r.xp, coins: r.coins }));
      const text = describeGain(r.xp - prevXp, r.coins - prevCoins);
      if (text) showToast(text, 'success');
    });

    setUserGames((prev) => {
      const newMap = new Map(prev);
      newMap.set(selectedGame.id, {
        rating: modalRating,
        hours: modalHours,
        review: modalReview,
        status: modalStatus,
        xp: 0,
        updatedAt: new Date().toISOString(),
      });
      return newMap;
    });

    // 2. Публикуем рецензию в ФОНЕ, не блокируя UI
    if (modalReview.trim().length >= 20) {
      const payload = {
        userId,
        gameId: selectedGame.id,
        gameTitle: selectedGame.title,
        gameCover: selectedGame.cover,
        rating: modalRating > 0 ? modalRating : null,
        text: modalReview.trim(),
      };
      authFetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(() => setSavedTick((v) => v + 1))
        .catch((err) => console.error('Publish review error:', err));
    }

    showToast('Изменения сохранены', 'success');
  };

  const publishReview = async () => {
    if (!userId || !selectedGame) return;
    if (modalReview.trim().length < 20) {
      showToast('Минимум 20 символов для публикации', 'error');
      return;
    }
    try {
      await authFetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          gameId: selectedGame.id,
          gameTitle: selectedGame.title,
          gameCover: selectedGame.cover,
          rating: modalRating > 0 ? modalRating : null,
          text: modalReview.trim(),
        }),
      });
      setSavedTick((v) => v + 1);
      showToast('Рецензия опубликована', 'success');
    } catch {
      showToast('Не удалось опубликовать', 'error');
    }
  };

  const deleteGame = async () => {
    if (!selectedGame || !userId) return;
    const title = selectedGame.title;
    await supabase
      .from('user_games')
      .delete()
      .eq('user_id', userId)
      .eq('game_id', selectedGame.id);
    setUserGames((prev) => {
      const newMap = new Map(prev);
      newMap.delete(selectedGame.id);
      return newMap;
    });
    setGames((prev) => prev.filter((g) => g.id !== selectedGame.id));
    showToast(`«${title}» удалена из коллекции`, 'info');
    closeGame();
  };

  if (!authLoading && !userId) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-6 py-20 text-center">
          <Lock className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-4">Доступ закрыт</h1>
          <p className="text-lg text-neutral-400 mb-6">
            Войди в аккаунт, чтобы видеть свои игры
          </p>
          <Link
            href="/auth"
            className="inline-block bg-indigo-500 text-white font-medium px-6 py-3 rounded-lg hover:bg-indigo-600 transition"
          >
            Войти
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Заголовок + кнопка Steam-импорта */}
        <PageHeading icon={Library} title="Мои игры" subtitle="Твоя личная коллекция" accent="indigo">
          <button
            onClick={() => setSteamImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#1b6ca8] to-[#2a8bd0] hover:from-[#1f7cc0] hover:to-[#37a0ec] text-white font-medium rounded-xl transition text-sm shadow-lg shadow-sky-900/30 hover:-translate-y-0.5"
          >
            <SteamIcon className="w-4 h-4" />
            Импорт из Steam
          </button>
        </PageHeading>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2 md:gap-3 mb-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 md:p-4 text-center">
            <Trophy className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
            <div className="text-lg md:text-xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-neutral-400">Всего</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 md:p-4 text-center">
            <Check className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            <div className="text-lg md:text-xl font-bold text-white">{stats.completed}</div>
            <div className="text-xs text-neutral-400">Прошёл</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 md:p-4 text-center">
            <Gamepad className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <div className="text-lg md:text-xl font-bold text-white">{stats.playing}</div>
            <div className="text-xs text-neutral-400">Играю</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 md:p-4 text-center">
            <Heart className="w-5 h-5 text-rose-500 mx-auto mb-1" />
            <div className="text-lg md:text-xl font-bold text-white">{stats.want}</div>
            
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 md:p-4 text-center">
            <XCircle className="w-5 h-5 text-neutral-500 mx-auto mb-1" />
            <div className="text-lg md:text-xl font-bold text-white">{stats.dropped}</div>
            <div className="text-xs text-neutral-400">Заброшено</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 md:p-4 text-center">
            <Clock className="w-5 h-5 text-purple-500 mx-auto mb-1" />
            <div className="text-lg md:text-xl font-bold text-white">{stats.totalHours}h</div>
            <div className="text-xs text-neutral-400">Часов</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 md:p-4 text-center">
            <Star className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
            <div className="text-lg md:text-xl font-bold text-white">
              {stats.avgRating}
              <span className="text-sm text-neutral-500">/10</span>
            </div>
            <div className="text-xs text-neutral-400">Ср. оценка</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-indigo-500" />
            {statusOptions.find((s) => s.id === activeTab)?.label}
            <span className="text-sm font-normal text-neutral-500">
              ({filteredGames.length})
            </span>
          </h2>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:flex-none">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none z-10" />
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value as TabType)}
                className="w-full sm:w-auto appearance-none bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-lg pl-8 pr-7 py-1.5 text-xs md:text-sm font-medium text-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer transition"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.id} value={opt.id} className="bg-neutral-900">
                    {opt.label} ({opt.count})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500 pointer-events-none" />
            </div>

            <div className="relative flex-1 sm:flex-none">
              <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none z-10" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortType)}
                className="w-full sm:w-auto appearance-none bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-lg pl-8 pr-7 py-1.5 text-xs md:text-sm font-medium text-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer transition"
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
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <GameCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="text-center py-20 bg-neutral-900 border border-neutral-800 rounded-xl">
            <Compass className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
            <p className="text-neutral-400 mb-2">
              {activeTab === 'all'
                ? 'Ты ещё не добавил ни одной игры'
                : 'В этой категории пока пусто'}
            </p>
            <p className="text-sm text-neutral-500 mb-6">
              Найди что-нибудь интересное на главной или импортируй из Steam
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/"
                className="inline-block px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition"
              >
                Найти игры
              </Link>
              <button
                onClick={() => setSteamImportOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#1b6ca8] hover:bg-[#155a8a] text-white font-medium rounded-lg transition"
              >
                <SteamIcon className="w-4 h-4" />
                Импорт из Steam
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredGames.map((game, idx) => {
              const data = userGames.get(game.id);
              return (
                <GameCard
                  key={game.id}
                  game={game}
                  onClick={() => openGame(game)}
                  userGameData={data}
                  isAuthenticated={!!userId}
                  index={idx}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Модалка игры */}
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
            ) : showDeleteConfirm ? (
              <div className="p-8">
                <div className="text-center">
                  <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-white mb-2">Удалить игру?</h2>
                  <p className="text-neutral-400 mb-6">
                    Ты уверен, что хочешь удалить{' '}
                    <span className="text-white font-medium">{selectedGame.title}</span> из
                    своего списка?
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={deleteGame}
                      className="bg-red-500 hover:bg-red-600 text-white font-medium px-6 py-3 rounded-lg transition flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Удалить
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium px-6 py-3 rounded-lg transition"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
                <GameMediaCarousel
                  game={selectedGame}
                  onScreenshotClick={setSelectedScreenshot}
                  steamBadge={<SteamRating gameTitle={selectedGame.title} variant="badge" />}
                />

                <div className="bg-neutral-800/70 rounded-xl p-3 md:p-4">
                  <div className="grid grid-cols-4 gap-1.5 md:gap-2">
                    <button
                      onClick={() => setModalStatus('want')}
                      className={`px-2 py-2.5 md:py-3 rounded-lg text-xs md:text-sm font-medium transition flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 ${
                        modalStatus === 'want'
                          ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                          : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      <Heart className="w-4 h-4" />
                      <span>Хочу</span>
                    </button>
                    <button
                      onClick={() => setModalStatus('playing')}
                      className={`px-2 py-2.5 md:py-3 rounded-lg text-xs md:text-sm font-medium transition flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 ${
                        modalStatus === 'playing'
                          ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                          : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      <Gamepad className="w-4 h-4" />
                      <span>Играю</span>
                    </button>
                    <button
                      onClick={() => setModalStatus('completed')}
                      className={`px-2 py-2.5 md:py-3 rounded-lg text-xs md:text-sm font-medium transition flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 ${
                        modalStatus === 'completed'
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                          : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      <span>Прошёл</span>
                    </button>
                    <button
                      onClick={() => setModalStatus('dropped')}
                      className={`px-2 py-2.5 md:py-3 rounded-lg text-xs md:text-sm font-medium transition flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 ${
                        modalStatus === 'dropped'
                          ? 'bg-neutral-500 text-white shadow-lg shadow-neutral-500/20'
                          : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Брошено</span>
                    </button>
                  </div>
                </div>

                <div>
                  {translating ? (
                    <div className="flex items-center gap-3 p-3 md:p-4 bg-neutral-800 rounded-lg">
                      <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                      <div>
                        <div className="text-sm text-white font-medium">
                          Переводим описание...
                        </div>
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

                <div className="bg-neutral-800 rounded-xl p-4 md:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white text-sm md:text-base flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-indigo-500" />
                      Твоя оценка
                    </h3>
                    <span className={`text-xl md:text-2xl font-bold ${getRatingColor(modalRating)}`}>
                      {modalRating > 0 ? `${modalRating}/10` : '—'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={modalRating}
                    onChange={(e) => setModalRating(parseInt(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, ${getSliderColor(modalRating)} 0%, ${getSliderColor(modalRating)} ${modalRating * 10}%, #404040 ${modalRating * 10}%, #404040 100%)`,
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
                      value={modalHours === 0 ? '' : modalHours}
                      onChange={(e) => {
                        const v = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                        setModalHours(v);
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
                    value={modalReview}
                    onChange={(e) => setModalReview(e.target.value)}
                    placeholder="Напиши своё мнение об игре..."
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-white placeholder:text-neutral-500 min-h-[80px] md:min-h-[100px] resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                  {modalReview.length > 0 && (
                    <div className="mt-1.5 text-right">
                      <span className="text-xs text-neutral-500">
                        {modalReview.length} символов
                      </span>
                    </div>
                  )}
                  <p className="text-[11px] text-neutral-500 mt-2">
                    Рецензии от 20 символов публикуются для всех игроков
                  </p>
                  <button
                    onClick={publishReview}
                    disabled={modalReview.trim().length < 20}
                    className="mt-3 w-full px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Оставить рецензию
                  </button>
                </div>

                <div className="flex gap-2 sticky bottom-0 z-30 -mx-4 px-4 py-3 bg-neutral-900/95 backdrop-blur border-t border-neutral-800 md:static md:mx-0 md:px-0 md:pb-0 md:pt-3 md:bg-transparent md:backdrop-blur-none">
                  <button
                    onClick={() => {
                      saveModalData();
                      closeGame();
                    }}
                    className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-medium py-3 rounded-lg transition flex items-center justify-center gap-2 text-sm md:text-base"
                  >
                    <Check className="w-4 h-4" />
                    <span>Сохранить</span>
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-medium py-3 rounded-lg transition flex items-center justify-center"
                    title="Удалить"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline ml-2">Удалить</span>
                  </button>
                  <button
                    onClick={closeGame}
                    className="px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium py-3 rounded-lg transition flex items-center justify-center"
                    title="Отмена"
                  >
                    <X className="w-4 h-4" />
                    <span className="hidden sm:inline ml-2">Отмена</span>
                  </button>
                </div>

                <div className="pt-4 border-t border-neutral-800">
                  <ReviewsSection gameId={selectedGame.id} refreshKey={savedTick} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedScreenshot && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4 cursor-pointer"
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
      )}

      {/* Steam Import Modal */}
      {userId && (
        <SteamImportModal
          isOpen={steamImportOpen}
          onClose={() => setSteamImportOpen(false)}
          userId={userId}
          onComplete={(n) => {
            if (n > 0) window.location.reload();
          }}
        />
      )}
    </div>
  );
}