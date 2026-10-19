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
import { cleanDescription } from '@/lib/text';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { getRatingColor, getSliderColor } from '@/lib/utils';
import GameCard from '@/components/GameCard';
import GameCardSkeleton from '@/components/GameCardSkeleton';
import GameMediaCarousel from '@/components/GameMediaCarousel';
import SteamRating from '@/components/SteamRating';
import GameSeries from '@/components/GameSeries';
import GamePersonalFields from '@/components/GamePersonalFields';
import ReviewComposer from '@/components/ReviewComposer';
import ShareButton from '@/components/ShareButton';
import { emptyAspects, hasAspects, aspectColumns, type Aspects } from '@/lib/aspects';
import GameMeta from '@/components/GameMeta';
import AdminEditButton from '@/components/AdminEditButton';
import TimeToBeat from '@/components/TimeToBeat';
import ScreenshotViewer from '@/components/ScreenshotViewer';
import ReviewsSection from '@/components/ReviewsSection';
import SteamImportModal from '@/components/SteamImportModal';
import { useGameUpdates, patchGameInList } from '@/lib/game-events';

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
  useGameUpdates((g) => setGames((prev) => patchGameInList(prev, g)));
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalRating, setModalRating] = useState(0);
  const [modalAspects, setModalAspects] = useState<Aspects>(emptyAspects());
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
  const [savingModal, setSavingModal] = useState(false);
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
        const data: Game = await response.json();
        return data;
      }
    } catch (err) {
      console.error('Ошибка загрузки полных данных:', err);
    }
    return null;
  };

  const translateDescription = async (rawText: string, gameId: number) => {
    const text = cleanDescription(rawText);
    const cached = localStorage.getItem(`translation_${gameId}`);
    if (cached) {
      setDescriptionRu(cleanDescription(cached));
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
      setModalAspects(data.aspects || emptyAspects());
      setModalHours(data.hours || 0);
      setModalReview(data.review || '');
      setModalStatus(data.status || 'none');
    } else {
      setModalRating(0);
      setModalAspects(emptyAspects());
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

    // Колонки аспектов пишем, только если они есть/были
    const hadAspects = hasAspects(userGames.get(selectedGame.id)?.aspects);
    const aspectPart = hasAspects(modalAspects) || hadAspects ? aspectColumns(modalAspects) : {};

    // 1. Сохраняем в user_games — это быстро
    const { error: saveError } = await supabase.from('user_games').upsert(
      {
        user_id: userId,
        game_id: selectedGame.id,
        rating: modalRating,
        hours: modalHours,
        review: modalReview,
        status: modalStatus,
        ...aspectPart,
      },
      { onConflict: 'user_id,game_id' },
    );

    if (saveError) throw saveError;

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
        aspects: modalAspects,
        updatedAt: new Date().toISOString(),
      });
      return newMap;
    });

    showToast('Изменения сохранены', 'success');
  };

  const publishReview = async () => {
    if (!userId || !selectedGame) return;
    if (modalReview.trim().length < 20) {
      showToast('Минимум 20 символов для публикации', 'error');
      return;
    }
    try {
      const response = await authFetch('/api/reviews', {
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
      if (!response.ok) throw new Error('Publish failed');
      setSavedTick((v) => v + 1);
      showToast('Рецензия опубликована', 'success');
      return true;
    } catch {
      showToast('Не удалось опубликовать', 'error');
      return false;
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
              className="fixed md:absolute top-[calc(0.75rem+env(safe-area-inset-top))] md:top-3 right-3 w-10 h-10 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full flex items-center justify-center transition z-40"
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

                        </div>
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



                <GamePersonalFields gameId={selectedGame.id} playtime={selectedGame.playtime} rating={modalRating} hours={modalHours} aspects={modalAspects} onRating={setModalRating} onHours={setModalHours} onAspects={setModalAspects} />
                <ReviewComposer key={selectedGame.id} value={modalReview} onChange={setModalReview} onPublish={publishReview} />

                <div className="flex gap-2 sticky bottom-0 z-30 -mx-4 px-4 py-3 bg-neutral-900/95 backdrop-blur border-t border-neutral-800 md:static md:mx-0 md:px-0 md:pb-0 md:pt-3 md:bg-transparent md:backdrop-blur-none">
                  <button
                    disabled={savingModal}
                    onClick={async () => {
                      if (savingModal) return;
                      setSavingModal(true);
                      try { await saveModalData(); closeGame(); }
                      catch { showToast('Не удалось сохранить. Попробуй ещё раз.', 'error'); }
                      finally { setSavingModal(false); }
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

                <GameSeries gameId={selectedGame.id} onOpen={openGame} />

                <div className="pt-4 border-t border-neutral-800">
                  <ReviewsSection gameId={selectedGame.id} refreshKey={savedTick} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedScreenshot && (
        <ScreenshotViewer
          images={(selectedGame?.screenshots || []).map((x) => x.image)}
          current={selectedScreenshot}
          onChange={setSelectedScreenshot}
          onClose={() => setSelectedScreenshot(null)}
        />
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
