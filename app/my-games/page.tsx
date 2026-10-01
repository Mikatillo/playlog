'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Heart, Gamepad, Check, Trophy, Star, Clock, Award, Loader2, Lock,
  X, MessageSquare, Monitor, Trash2, AlertTriangle, XCircle,
  ChevronDown, ChevronUp, Filter, SortAsc, SortDesc,
} from 'lucide-react';
import { Game, GameData, calculateLevel } from '@/types/game';
import { mapRawgGame, RawgGame } from '@/lib/rawg';
import { supabase } from '@/lib/supabase';
import GameCard from '@/components/GameCard';
import Header from '@/components/Header';

type TabType = 'all' | 'want' | 'playing' | 'completed' | 'dropped';
type SortType =
  | 'rating-asc'
  | 'rating-desc'
  | 'hours-asc'
  | 'hours-desc'
  | 'year-asc'
  | 'year-desc';

function getRatingColor(rating: number): string {
  if (rating >= 8) return 'text-emerald-400';
  if (rating >= 6) return 'text-yellow-400';
  if (rating >= 4) return 'text-orange-400';
  return 'text-red-400';
}

function getSliderColor(value: number): string {
  if (value >= 8) return '#10b981';
  if (value >= 6) return '#eab308';
  if (value >= 4) return '#f97316';
  return '#ef4444';
}

function getMetacriticColor(score: number): string {
  if (score >= 75) return 'bg-emerald-500/90 text-white';
  if (score >= 50) return 'bg-yellow-500/90 text-black';
  if (score >= 25) return 'bg-orange-500/90 text-white';
  return 'bg-red-500/90 text-white';
}

export default function MyGamesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchInput, setSearchInput] = useState('');
  const [userGames, setUserGames] = useState<Map<number, GameData>>(new Map());
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState<any>(null);
  const [profile, setProfile] = useState({
    nickname: '',
    xp: 0,
    totalGames: 0,
    completedGames: 0,
    totalHours: 0,
  });
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalRating, setModalRating] = useState(0);
  const [modalHours, setModalHours] = useState(0);
  const [modalReview, setModalReview] = useState('');
  const [modalStatus, setModalStatus] = useState<
    'none' | 'want' | 'playing' | 'completed' | 'dropped'
  >('none');
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortType>('year-desc');
  const [screenshotsLoaded, setScreenshotsLoaded] = useState(false);
  const [descriptionRu, setDescriptionRu] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (cancelled) return;
      if (!user) {
        setAuthUser(null);
        setLoading(false);
        return;
      }
      setAuthUser(user);

      const [profileRes, gamesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('user_games').select('*').eq('user_id', user.id),
      ]);
      if (cancelled) return;

      if (profileRes.data) {
        const p = profileRes.data;
        setProfile({
          nickname: p.nickname || user.email?.split('@')[0] || 'Игрок',
          xp: p.xp || 0,
          totalGames: p.total_games || 0,
          completedGames: p.completed_games || 0,
          totalHours: p.total_hours || 0,
        });
      }

      if (gamesRes.data && gamesRes.data.length > 0) {
        const map = new Map<number, GameData>();
        const ids: number[] = [];
        gamesRes.data.forEach((g) => {
          map.set(g.game_id, {
            rating: g.rating || 0,
            hours: g.hours || 0,
            review: g.review || '',
            status: g.status || 'none',
            xp: 0,
          });
          ids.push(g.game_id);
        });
        setUserGames(map);
        await loadGames(ids);
      } else {
        setLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadGames = async (ids: number[]) => {
    setLoading(true);
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const response = await fetch(`/api/games/${id}`);
            if (response.ok) {
              const data: RawgGame = await response.json();
              return mapRawgGame(data);
            }
          } catch (err) {
            console.error(`Ошибка загрузки игры ${id}:`, err);
          }
          return null;
        }),
      );
      setGames(results.filter((g): g is Game => g !== null));
    } catch (error) {
      console.error('Ошибка загрузки игр:', error);
    }
    setLoading(false);
  };

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

  const levelInfo = calculateLevel(profile.xp);

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
    if (searchInput) {
      filtered = filtered.filter((game) =>
        game.title.toLowerCase().includes(searchInput.toLowerCase()),
      );
    }
    filtered.sort((a, b) => {
      const dataA = userGames.get(a.id);
      const dataB = userGames.get(b.id);
      const ratingA = dataA?.rating || 0;
      const ratingB = dataB?.rating || 0;
      const hoursA = dataA?.hours || 0;
      const hoursB = dataB?.hours || 0;
      switch (sortBy) {
        case 'rating-asc':
          return ratingA - ratingB;
        case 'rating-desc':
          return ratingB - ratingA;
        case 'hours-asc':
          return hoursA - hoursB;
        case 'hours-desc':
          return hoursB - hoursA;
        case 'year-asc':
          return a.year - b.year;
        case 'year-desc':
          return b.year - a.year;
        default:
          return 0;
      }
    });
    return filtered;
  }, [activeTab, searchInput, games, userGames, sortBy]);

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

  const tabs: { id: TabType; label: string; icon: any; count: number }[] = [
    { id: 'all', label: 'Все', icon: Trophy, count: stats.total },
    { id: 'want', label: 'Хочу', icon: Heart, count: stats.want },
    { id: 'playing', label: 'Играю', icon: Gamepad, count: stats.playing },
    { id: 'completed', label: 'Прошёл', icon: Check, count: stats.completed },
    { id: 'dropped', label: 'Заброшено', icon: XCircle, count: stats.dropped },
  ];

  const openGame = async (game: Game) => {
    setSelectedGame(game);
    setModalLoading(true);
    setShowDeleteConfirm(false);
    setDescriptionExpanded(false);
    setScreenshotsLoaded(false);
    setDescriptionRu(null);
    setTranslating(false);
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
      setScreenshotsLoaded(true);
      if (fullGame.descriptionRaw) {
        translateDescription(fullGame.descriptionRaw, game.id);
      }
    } else {
      setScreenshotsLoaded(true);
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
    if (!selectedGame || !authUser) return;
    await supabase.from('user_games').upsert(
      {
        user_id: authUser.id,
        game_id: selectedGame.id,
        rating: modalRating,
        hours: modalHours,
        review: modalReview,
        status: modalStatus,
      },
      { onConflict: 'user_id,game_id' },
    );
    setUserGames((prev) => {
      const newMap = new Map(prev);
      newMap.set(selectedGame.id, {
        rating: modalRating,
        hours: modalHours,
        review: modalReview,
        status: modalStatus,
        xp: 0,
      });
      return newMap;
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const deleteGame = async () => {
    if (!selectedGame || !authUser) return;
    await supabase
      .from('user_games')
      .delete()
      .eq('user_id', authUser.id)
      .eq('game_id', selectedGame.id);
    setUserGames((prev) => {
      const newMap = new Map(prev);
      newMap.delete(selectedGame.id);
      return newMap;
    });
    setGames((prev) => prev.filter((g) => g.id !== selectedGame.id));
    closeGame();
  };

  if (!authUser && !loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Header />
        <div className="max-w-7xl mx-auto px-6 py-20 text-center">
          <Lock className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-4">Доступ закрыт</h1>
          <p className="text-lg text-neutral-400 mb-6">
            Войди в аккаунт, чтобы видеть свои игры
          </p>
          <a
            href="/auth"
            className="inline-block bg-indigo-500 text-white font-medium px-6 py-3 rounded-lg hover:bg-indigo-600 transition"
          >
            Войти
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header
        profile={profile}
        levelInfo={levelInfo}
        userId={authUser?.id}
        onProfileUpdate={(updated) => setProfile((prev) => ({ ...prev, ...updated }))}
        achievementsStats={{
          total: stats.total,
          completed: stats.completed,
          playing: stats.playing,
          want: stats.want,
          dropped: stats.dropped,
          totalHours: stats.totalHours,
          ratedGames: Array.from(userGames.values()).filter((d) => d.rating > 0).length,
          reviewsCount: Array.from(userGames.values()).filter(
            (d) => d.review && d.review.length > 0,
          ).length,
        }}
      />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Мои игры</h1>
          <p className="text-neutral-400">Твоя личная коллекция</p>
        </div>

        {/* Поиск */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 mb-6">
          <input
            type="text"
            placeholder="Поиск в моих играх..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full bg-transparent px-4 py-2 text-white placeholder:text-neutral-500 focus:outline-none"
          />
        </div>

        {/* Фильтр */}
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden mb-6">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-neutral-800/50 transition"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-neutral-400" />
              <h2 className="font-semibold text-white">Фильтры</h2>
              {activeTab !== 'all' && (
                <span className="text-xs bg-indigo-500 text-white px-2 py-0.5 rounded-full">
                  {tabs.find((t) => t.id === activeTab)?.label}
                </span>
              )}
              {sortBy !== 'year-desc' && (
                <span className="text-xs bg-indigo-500 text-white px-2 py-0.5 rounded-full ml-1">
                  Сортировка
                </span>
              )}
            </div>
            {filtersOpen ? (
              <ChevronUp className="w-4 h-4 text-neutral-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-neutral-400" />
            )}
          </button>
          {filtersOpen && (
            <div className="px-5 pb-5 space-y-4 border-t border-neutral-800 pt-4">
              <div>
                <label className="text-xs font-medium text-neutral-400 mb-2 block">
                  Статус
                </label>
                <div className="flex flex-wrap gap-2">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${
                          activeTab === tab.id
                            ? 'bg-indigo-500 text-white'
                            : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {tab.label} ({tab.count})
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 mb-2 block">
                  Сортировка
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => setSortBy('year-desc')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5 ${
                      sortBy === 'year-desc'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    <SortDesc className="w-3.5 h-3.5" />
                    Сначала новые
                  </button>
                  <button
                    onClick={() => setSortBy('year-asc')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5 ${
                      sortBy === 'year-asc'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    <SortAsc className="w-3.5 h-3.5" />
                    Сначала старые
                  </button>
                  <button
                    onClick={() => setSortBy('rating-desc')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5 ${
                      sortBy === 'rating-desc'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    <Star className="w-3.5 h-3.5" />
                    Оценка ↓
                  </button>
                  <button
                    onClick={() => setSortBy('rating-asc')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5 ${
                      sortBy === 'rating-asc'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    <Star className="w-3.5 h-3.5" />
                    Оценка ↑
                  </button>
                  <button
                    onClick={() => setSortBy('hours-desc')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5 ${
                      sortBy === 'hours-desc'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Часы ↓
                  </button>
                  <button
                    onClick={() => setSortBy('hours-asc')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5 ${
                      sortBy === 'hours-asc'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Часы ↑
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 mb-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
            <Trophy className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
            <div className="text-xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-neutral-400">Всего</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
            <Check className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            <div className="text-xl font-bold text-white">{stats.completed}</div>
            <div className="text-xs text-neutral-400">Прошёл</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
            <Gamepad className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <div className="text-xl font-bold text-white">{stats.playing}</div>
            <div className="text-xs text-neutral-400">Играю</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
            <Heart className="w-5 h-5 text-rose-500 mx-auto mb-1" />
            <div className="text-xl font-bold text-white">{stats.want}</div>
            <div className="text-xs text-neutral-400">Хочу</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
            <XCircle className="w-5 h-5 text-neutral-500 mx-auto mb-1" />
            <div className="text-xl font-bold text-white">{stats.dropped}</div>
            <div className="text-xs text-neutral-400">Заброшено</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
            <Clock className="w-5 h-5 text-purple-500 mx-auto mb-1" />
            <div className="text-xl font-bold text-white">{stats.totalHours}h</div>
            <div className="text-xs text-neutral-400">Часов</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
            <Star className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
            <div className="text-xl font-bold text-white">
              {stats.avgRating}
              <span className="text-sm text-neutral-500">/10</span>
            </div>
            <div className="text-xs text-neutral-400">Ср. оценка</div>
          </div>
        </div>

        {/* Список игр */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <span className="ml-3 text-neutral-400">Загрузка...</span>
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="text-center py-20 bg-neutral-900 border border-neutral-800 rounded-xl">
            <p className="text-neutral-400 mb-2">
              {activeTab === 'all' ? 'Ты ещё не добавил ни одной игры' : 'Список пуст'}
            </p>
            <p className="text-sm text-neutral-500">
              Вернись на главную и добавь игры в список
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredGames.map((game) => {
              const data = userGames.get(game.id);
              return (
                <GameCard
                  key={game.id}
                  game={game}
                  onClick={() => openGame(game)}
                  userGameData={data}
                  isAuthenticated={!!authUser}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Модалка игры */}
      {selectedGame && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-neutral-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative shadow-2xl border border-neutral-800">
            <button
              onClick={closeGame}
              className="absolute top-4 right-4 w-10 h-10 bg-neutral-800 hover:bg-neutral-700 rounded-full flex items-center justify-center transition z-10"
            >
              <X className="w-5 h-5 text-neutral-400" />
            </button>
            {saved && (
              <div className="fixed top-4 right-20 bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium z-50 shadow-lg">
                Сохранено!
              </div>
            )}
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
              <div className="p-8">
                {/* Обложка */}
                <div className="mb-6">
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-neutral-800">
                    <img
                      src={selectedGame.cover}
                      alt={selectedGame.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    {selectedGame.metacritic && selectedGame.metacritic > 0 && (
                      <div
                        className={`absolute top-4 right-4 ${getMetacriticColor(selectedGame.metacritic)} px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-lg`}
                      >
                        <span className="text-sm font-bold">{selectedGame.metacritic}</span>
                        <span className="text-[10px] opacity-70">MC</span>
                      </div>
                    )}
                    <div className="absolute bottom-4 left-4 right-4">
                      <h1 className="text-3xl font-bold text-white drop-shadow-lg">
                        {selectedGame.title}
                      </h1>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedGame.genres?.map((g) => (
                          <span
                            key={g.id}
                            className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded text-xs font-medium"
                          >
                            {g.name}
                          </span>
                        ))}
                        <span className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white rounded text-xs font-medium">
                          {selectedGame.year}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Оценки */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {selectedGame.metacritic && selectedGame.metacritic > 0 && (
                    <span
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${getMetacriticColor(selectedGame.metacritic)}`}
                    >
                      <Award className="w-4 h-4" />
                      <span>{selectedGame.metacritic}</span>
                      <span className="text-[10px] opacity-70">Metacritic</span>
                    </span>
                  )}
                </div>

                {/* Описание */}
                <div className="mb-6">
                  {translating ? (
                    <div className="flex items-center gap-3 p-4 bg-neutral-800 rounded-lg">
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
                          <p className="text-neutral-300 leading-relaxed">{descriptionRu}</p>
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
                          <p className="text-neutral-300 leading-relaxed line-clamp-4">
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
                      <p className="text-neutral-400 leading-relaxed mb-4 line-clamp-3">
                        {selectedGame.description}
                      </p>
                      <button
                        onClick={() => {
                          if (selectedGame?.descriptionRaw) {
                            translateDescription(selectedGame.descriptionRaw, selectedGame.id);
                          }
                        }}
                        className="text-sm text-indigo-400 hover:text-indigo-300 transition flex items-center gap-2"
                      >
                        Перевести на русский
                      </button>
                    </div>
                  )}
                </div>

                {/* Платформы */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-neutral-400 mb-2">Платформы:</h3>
                  <div className="flex gap-2 flex-wrap">
                    {selectedGame.platforms.map((platform) => (
                      <div
                        key={platform}
                        className="px-3 py-1 bg-neutral-800 rounded-lg text-sm text-neutral-300"
                      >
                        {platform}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Скриншоты */}
                {!screenshotsLoaded ? (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-neutral-400 mb-3 flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-indigo-500" /> Скриншоты
                    </h3>
                    <div className="bg-neutral-800 rounded-lg p-8 flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
                      <div className="text-sm text-neutral-400">Загрузка скриншотов...</div>
                    </div>
                  </div>
                ) : selectedGame.screenshots && selectedGame.screenshots.length > 0 ? (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-neutral-400 mb-3 flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-indigo-500" /> Скриншоты (
                      {selectedGame.screenshots.length})
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {selectedGame.screenshots.map((shot) => (
                        <div
                          key={shot.id}
                          className="aspect-video rounded-lg overflow-hidden bg-neutral-800 cursor-pointer group/shot"
                          onClick={() => setSelectedScreenshot(shot.image)}
                        >
                          <img
                            src={shot.image}
                            alt={`Screenshot ${shot.id}`}
                            className="w-full h-full object-cover group-hover/shot:scale-110 transition-transform duration-300"
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-neutral-400 mb-3 flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-indigo-500" /> Скриншоты
                    </h3>
                    <div className="bg-neutral-800 rounded-lg p-6 text-center text-neutral-500 text-sm">
                      Скриншоты не найдены для этой игры
                    </div>
                  </div>
                )}

                {/* Статусы */}
                <div className="bg-neutral-800 rounded-xl p-5 mb-6">
                  <h2 className="font-semibold text-white mb-3">Статус</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <button
                      onClick={() => setModalStatus('want')}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
                        modalStatus === 'want'
                          ? 'bg-rose-500 text-white'
                          : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      <Heart className="w-4 h-4" /> Хочу
                    </button>
                    <button
                      onClick={() => setModalStatus('playing')}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
                        modalStatus === 'playing'
                          ? 'bg-blue-500 text-white'
                          : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      <Gamepad className="w-4 h-4" /> Играю
                    </button>
                    <button
                      onClick={() => setModalStatus('completed')}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
                        modalStatus === 'completed'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      <Check className="w-4 h-4" /> Прошёл
                    </button>
                    <button
                      onClick={() => setModalStatus('dropped')}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
                        modalStatus === 'dropped'
                          ? 'bg-neutral-500 text-white'
                          : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      <XCircle className="w-4 h-4" /> Заброшено
                    </button>
                  </div>
                </div>

                {/* Оценка */}
                <div className="bg-neutral-800 rounded-xl p-5 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-indigo-500" /> Твоя оценка
                    </h3>
                    <span className={`text-2xl font-bold ${getRatingColor(modalRating)}`}>
                      {modalRating > 0 ? `${modalRating}/10` : '—'}
                    </span>
                  </div>
                  <div className="relative">
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
                    <div className="flex justify-between text-xs text-neutral-500 mt-2">
                      <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span>
                      <span>5</span><span>6</span><span>7</span><span>8</span><span>9</span>
                      <span>10</span>
                    </div>
                  </div>
                </div>

                {/* Часы */}
                <div className="bg-neutral-800 rounded-xl p-5 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-500" /> Часов наиграно
                    </h3>
                    {selectedGame.playtime && (
                      <span className="text-xs text-neutral-400 bg-neutral-900/50 px-2.5 py-1 rounded-md border border-neutral-700 flex items-center gap-1.5">
                        <span className="text-indigo-400">⏱</span>
                        Среднее время игроков: ~{selectedGame.playtime} ч.
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
                      className="w-24 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="0"
                    />
                    <span className="text-sm text-neutral-400">часов</span>
                  </div>
                </div>

                {/* Рецензия */}
                <div className="bg-neutral-800 rounded-xl p-5 mb-6">
                  <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-500" /> Твоя рецензия
                  </h3>
                  <textarea
                    value={modalReview}
                    onChange={(e) => setModalReview(e.target.value)}
                    placeholder="Напиши своё мнение об игре..."
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-white placeholder:text-neutral-500 min-h-[100px] resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {modalReview.length > 0 && (
                    <div className="mt-2 text-right">
                      <span className="text-xs text-neutral-500">
                        {modalReview.length} символов
                      </span>
                    </div>
                  )}
                </div>

                {/* Кнопки */}
                <div className="flex gap-2 pt-4 border-t border-neutral-800">
                  <button
                    onClick={async () => {
                      await saveModalData();
                      closeGame();
                    }}
                    className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-medium py-3 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span className="hidden sm:inline">Сохранить</span>
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
              </div>
            )}
          </div>
        </div>
      )}

      {/* Модалка скриншота */}
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
    </div>
  );
}