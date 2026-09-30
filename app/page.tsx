'use client';

import { Search, Filter, X, Star, Clock, MessageSquare, Trophy, TrendingUp, Download, Upload, Zap, Loader2, Gamepad2, Lock, Check, Heart, Gamepad, Monitor } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Game, GameData, XP_RULES, calculateLevel, UserProfile } from '@/types/game';
import { mapRawgGame, RawgGame } from '@/lib/rawg';
import { supabase } from '@/lib/supabase';
import GameCard from '@/components/GameCard';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';

const genres = [
  { id: '', name: 'Все' },
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

const platforms = ['Все', 'PC', 'PS5', 'Xbox', 'Switch'];

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('Все');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchMode, setSearchMode] = useState<'browse' | 'results'>('browse');
  const [suggestions, setSuggestions] = useState<Game[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sortBy, setSortBy] = useState<string>('-added');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [userRating, setUserRating] = useState(0);
  const [userHours, setUserHours] = useState(0);
  const [review, setReview] = useState('');
  const [gameStatus, setGameStatus] = useState<'none' | 'want' | 'playing' | 'completed'>('none');
  const [saved, setSaved] = useState(false);
  const [xpGain, setXpGain] = useState<number | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [suggestionTimeout, setSuggestionTimeout] = useState<NodeJS.Timeout | null>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile>({
    nickname: '',
    xp: 0,
    totalGames: 0,
    completedGames: 0,
    totalHours: 0,
  });

  const levelInfo = calculateLevel(profile.xp);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setAuthUser(user);
      if (user) {
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setProfile({
                nickname: data.nickname || user.email?.split('@')[0] || 'Игрок',
                xp: data.xp || 0,
                totalGames: data.total_games || 0,
                completedGames: data.completed_games || 0,
                totalHours: data.total_hours || 0,
              });
            }
          });
      }
    });
  }, []);

  const loadGames = async (pageNum: number, append: boolean = false) => {
    setLoading(true);
    try {
      let url = `/api/games?page=${pageNum}&pageSize=20&ordering=${sortBy}`;
      if (selectedGenre) url += `&genres=${selectedGenre}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.results) {
        const mappedGames = data.results.map((g: RawgGame) => mapRawgGame(g));
        setGames(append ? [...games, ...mappedGames] : mappedGames);
        setHasMore(data.next !== null);
      }
    } catch (error) {
      console.error('Ошибка загрузки:', error);
    }
    setLoading(false);
  };

  const handleInputChange = (value: string) => {
    setSearchInput(value);
    if (suggestionTimeout) clearTimeout(suggestionTimeout);
    if (value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/games/search?search=${encodeURIComponent(value)}`);
        const data = await response.json();
        if (data.results) {
          const mapped = data.results.slice(0, 5).map((g: RawgGame) => mapRawgGame(g));
          setSuggestions(mapped);
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error('Ошибка подсказок:', error);
      }
    }, 300);
    setSuggestionTimeout(timeout);
  };

  const handleSearchSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchInput.trim().length > 0) {
      setShowSuggestions(false);
      setSearchQuery(searchInput.trim());
      setSearchMode('results');
      setLoading(true);
      try {
        const response = await fetch(`/api/games/search?search=${encodeURIComponent(searchInput.trim())}`);
        const data = await response.json();
        if (data.results) {
          const mappedGames = data.results.map((g: RawgGame) => mapRawgGame(g));
          setGames(mappedGames);
          setHasMore(false);
        }
      } catch (error) {
        console.error('Ошибка поиска:', error);
      }
      setLoading(false);
    }
  };

  const handleSuggestionClick = async (game: Game) => {
    setShowSuggestions(false);
    setSearchInput(game.title);
    setSearchQuery(game.title);
    setSearchMode('results');
    setLoading(true);
    try {
      const response = await fetch(`/api/games/search?search=${encodeURIComponent(game.title)}`);
      const data = await response.json();
      if (data.results) {
        const mappedGames = data.results.map((g: RawgGame) => mapRawgGame(g));
        setGames(mappedGames);
        setHasMore(false);
      }
    } catch (error) {
      console.error('Ошибка поиска:', error);
    }
    setLoading(false);
  };

  const handleReset = () => {
    setSearchInput('');
    setSearchQuery('');
    setSearchMode('browse');
    setSuggestions([]);
    setShowSuggestions(false);
    loadGames(1);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchMode === 'browse' && !searchQuery) {
      loadGames(1);
    }
  }, [selectedGenre, sortBy, searchMode]);

  const addXp = async (amount: number) => {
    setProfile((prev) => {
      const newProfile = { ...prev, xp: prev.xp + amount };
      localStorage.setItem('user_profile', JSON.stringify(newProfile));
      return newProfile;
    });
    setXpGain(amount);
    setTimeout(() => setXpGain(null), 2000);

    if (authUser) {
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('xp')
        .eq('id', authUser.id)
        .single();

      if (currentProfile) {
        await supabase
          .from('profiles')
          .update({ xp: (currentProfile.xp || 0) + amount })
          .eq('id', authUser.id);
      }
    }
  };

  const exportData = () => {
    const data: Record<number, GameData> = {};
    games.forEach((game) => {
      const saved = localStorage.getItem(`game_${game.id}`);
      if (saved) data[game.id] = JSON.parse(saved);
    });
    const blob = new Blob([JSON.stringify({ profile, games: data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `playlog_backup_${Date.now()}.json`;
    a.click();
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.profile) {
          localStorage.setItem('user_profile', JSON.stringify(data.profile));
          setProfile(data.profile);
        }
        if (data.games) {
          Object.entries(data.games).forEach(([id, gameData]) => {
            localStorage.setItem(`game_${id}`, JSON.stringify(gameData));
          });
        }
        alert('Данные импортированы!');
        window.location.reload();
      } catch (err) {
        alert('Ошибка импорта');
      }
    };
    reader.readAsText(file);
  };

  const openGame = (game: Game) => {
    setSelectedGame(game);
    const savedData = localStorage.getItem(`game_${game.id}`);
    if (savedData) {
      const data: GameData = JSON.parse(savedData);
      setUserRating(data.rating || 0);
      setUserHours(data.hours || 0);
      setReview(data.review || '');
      setGameStatus(data.status || 'none');
    } else {
      setUserRating(0);
      setUserHours(0);
      setReview('');
      setGameStatus('none');
    }
  };

  const closeGame = () => {
    setSelectedGame(null);
  };

  const saveData = async (
    newRating: number,
    newHours: number,
    newReview: string,
    newStatus: 'none' | 'want' | 'playing' | 'completed'
  ) => {
    if (!selectedGame) return;
    const data: GameData = {
      rating: newRating,
      hours: newHours,
      review: newReview,
      status: newStatus,
      xp: 0,
    };
    localStorage.setItem(`game_${selectedGame.id}`, JSON.stringify(data));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);

    if (authUser) {
      await supabase
        .from('user_games')
        .upsert(
          {
            user_id: authUser.id,
            game_id: selectedGame.id,
            rating: newRating,
            hours: newHours,
            review: newReview,
            status: newStatus,
          },
          { onConflict: 'user_id,game_id' }
        );
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadGames(nextPage, true);
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header profile={profile} levelInfo={levelInfo} />

      {xpGain && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium z-50 shadow-lg animate-bounce">
          <Zap className="w-4 h-4 inline mr-1" /> +{xpGain} XP!
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8">
        {authUser && <Sidebar profile={profile} levelInfo={levelInfo} />}

        <main className="flex-1 space-y-6">
          {/* Приветствие */}
          {authUser && (
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xl font-semibold">
                    {profile.nickname.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-neutral-900">
                      Привет, {profile.nickname}! 👋
                    </h2>
                    <p className="text-sm text-neutral-500 mt-0.5">
                      Уровень {levelInfo.level} • {profile.xp} XP • {profile.completedGames} игр пройдено
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={exportData}
                    className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-200 transition flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Экспорт
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-200 transition flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" /> Импорт
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={importData}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Поиск */}
          <div className="relative">
            <div className="bg-white rounded-xl border border-neutral-200 p-4 flex items-center gap-3 shadow-sm">
              <Search className="w-5 h-5 text-neutral-400 flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Поиск игр..."
                value={searchInput}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleSearchSubmit}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                className="flex-1 bg-transparent text-neutral-900 placeholder:text-neutral-400 focus:outline-none text-base"
              />
              {(searchInput || searchMode === 'results') && (
                <button
                  onClick={handleReset}
                  className="p-2 hover:bg-neutral-100 rounded-lg transition"
                >
                  <X className="w-4 h-4 text-neutral-500" />
                </button>
              )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl border border-neutral-200 shadow-lg z-50 overflow-hidden"
              >
                {suggestions.map((game) => (
                  <div
                    key={game.id}
                    onClick={() => handleSuggestionClick(game)}
                    className="flex items-center gap-3 p-3 hover:bg-neutral-50 cursor-pointer border-b border-neutral-100 last:border-b-0"
                  >
                    <img
                      src={game.cover}
                      alt={game.title}
                      className="w-12 h-16 object-cover rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://via.placeholder.com/48x64/neutral-100/neutral-400?text=?';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-neutral-900 truncate">{game.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-neutral-500">{game.genre}</span>
                        <span className="text-xs text-neutral-400">•</span>
                        <span className="text-xs text-neutral-500">{game.year}</span>
                        <span className="text-xs text-neutral-500 flex items-center gap-1 ml-auto">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" /> {game.rating}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Фильтры */}
          {searchMode === 'browse' && (
            <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="w-4 h-4 text-neutral-600" />
                <h2 className="font-semibold text-neutral-900">Фильтры</h2>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-600 mb-2 block">Жанр</label>
                <div className="flex flex-wrap gap-2">
                  {genres.map((genre) => (
                    <button
                      key={genre.id}
                      onClick={() => {
                        setSelectedGenre(genre.id);
                        setPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                        selectedGenre === genre.id
                          ? 'bg-indigo-500 text-white'
                          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                      }`}
                    >
                      {genre.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-neutral-100">
                <div>
                  <label className="text-xs font-medium text-neutral-600 mb-2 block">Платформа</label>
                  <div className="flex flex-wrap gap-2">
                    {platforms.map((platform) => (
                      <button
                        key={platform}
                        onClick={() => setSelectedPlatform(platform)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                          selectedPlatform === platform
                            ? 'bg-indigo-500 text-white'
                            : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                        }`}
                      >
                        {platform}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-neutral-600 mb-2 block">Сортировка</label>
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value);
                      setPage(1);
                    }}
                    className="px-3 py-1.5 bg-neutral-100 border-0 rounded-lg text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="-added">Популярность</option>
                    <option value="-rating">Рейтинг</option>
                    <option value="-released">Дата выхода</option>
                    <option value="-metacritic">Metacritic</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Результаты */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-500" />
                {searchMode === 'results' ? `Результаты: "${searchQuery}"` : 'Популярные игры'}
              </h2>
              <span className="text-sm text-neutral-500">{games.length} игр</span>
            </div>

            {loading && games.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <span className="ml-3 text-neutral-600">Загрузка...</span>
              </div>
            ) : games.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-xl border border-neutral-200">
                <p className="text-neutral-500">Ничего не найдено</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {games.map((game) => {
                    const savedData = localStorage.getItem(`game_${game.id}`);
                    const userData: GameData | null = savedData ? JSON.parse(savedData) : null;
                    return (
                      <GameCard
                        key={game.id}
                        game={game}
                        onClick={() => openGame(game)}
                        userGameData={userData || undefined}
                      />
                    );
                  })}
                </div>

                {hasMore && searchMode === 'browse' && (
                  <div className="text-center mt-8">
                    <button
                      onClick={loadMore}
                      disabled={loading}
                      className="px-6 py-3 bg-white border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 transition"
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

      {/* Модальное окно игры */}
      {selectedGame && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative shadow-2xl">
            <button
              onClick={closeGame}
              className="absolute top-4 right-4 w-10 h-10 bg-neutral-100 hover:bg-neutral-200 rounded-full flex items-center justify-center transition z-10"
            >
              <X className="w-5 h-5 text-neutral-600" />
            </button>

            {saved && (
              <div className="fixed top-4 right-20 bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium z-50 shadow-lg">
                Сохранено!
              </div>
            )}

            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <div>
                  <div className="rounded-xl overflow-hidden shadow-lg">
                    <img
                      src={selectedGame.cover}
                      alt={selectedGame.title}
                      className="w-full aspect-[2/3] object-cover"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 space-y-4">
                  <div>
                    <h1 className="text-3xl font-bold text-neutral-900 mb-3">{selectedGame.title}</h1>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium">
                        {selectedGame.genre}
                      </span>
                      <span className="px-3 py-1 bg-neutral-100 text-neutral-700 rounded-lg text-sm font-medium">
                        {selectedGame.year}
                      </span>
                      <span className="px-3 py-1 bg-yellow-50 text-yellow-700 rounded-lg text-sm font-medium flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" /> {selectedGame.rating}
                      </span>
                    </div>
                    <p className="text-neutral-600 leading-relaxed">{selectedGame.description}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-neutral-50 rounded-lg p-3 text-center">
                      <Star className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
                      <div className="font-semibold text-neutral-900">{selectedGame.rating}</div>
                      <div className="text-xs text-neutral-500">Рейтинг</div>
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-3 text-center">
                      <Monitor className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
                      <div className="font-semibold text-neutral-900">{selectedGame.platforms.length}</div>
                      <div className="text-xs text-neutral-500">Платформ</div>
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-3 text-center">
                      <Trophy className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                      <div className="font-semibold text-neutral-900">{selectedGame.year}</div>
                      <div className="text-xs text-neutral-500">Год</div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-neutral-600 mb-2">Платформы:</h3>
                    <div className="flex gap-2 flex-wrap">
                      {selectedGame.platforms.map((platform) => (
                        <div
                          key={platform}
                          className="px-3 py-1 bg-neutral-100 rounded-lg text-sm text-neutral-700"
                        >
                          {platform}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Кнопки статусов */}
              {authUser ? (
                <div className="bg-neutral-50 rounded-xl p-5 mb-6">
                  <h2 className="font-semibold text-neutral-900 mb-3">Добавить в список</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        setGameStatus('want');
                        saveData(userRating, userHours, review, 'want');
                        addXp(XP_RULES.ADD_GAME);
                      }}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
                        gameStatus === 'want'
                          ? 'bg-rose-500 text-white'
                          : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      <Heart className="w-4 h-4" /> Хочу пройти
                    </button>
                    <button
                      onClick={() => {
                        setGameStatus('playing');
                        saveData(userRating, userHours, review, 'playing');
                        addXp(XP_RULES.ADD_GAME);
                      }}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
                        gameStatus === 'playing'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      <Gamepad className="w-4 h-4" /> В процессе
                    </button>
                    <button
                      onClick={() => {
                        setGameStatus('completed');
                        saveData(userRating, userHours, review, 'completed');
                        addXp(XP_RULES.COMPLETE);
                      }}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
                        gameStatus === 'completed'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      <Check className="w-4 h-4" /> Прошёл
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-neutral-50 rounded-xl p-6 mb-6 text-center">
                  <Lock className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
                  <p className="text-neutral-600 mb-3">Войди, чтобы добавлять игры в список</p>
                  <a
                    href="/auth"
                    className="inline-block px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition"
                  >
                    Войти
                  </a>
                </div>
              )}

              {/* Оценка и часы */}
              {authUser ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-neutral-50 rounded-xl p-5">
                    <h3 className="font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-indigo-500" /> Твоя оценка
                    </h3>
                    <div className="flex gap-2 mb-3">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          onClick={() => {
                            setUserRating(num);
                            saveData(num, userHours, review, gameStatus);
                            addXp(XP_RULES.RATE);
                          }}
                          className={`w-10 h-10 rounded-lg font-medium transition ${
                            userRating >= num
                              ? 'bg-yellow-400 text-white'
                              : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                    {userRating > 0 && (
                      <div className="text-sm text-neutral-600">Твоя оценка: {userRating}/5</div>
                    )}
                  </div>

                  <div className="bg-neutral-50 rounded-xl p-5">
                    <h3 className="font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-500" /> Часов наиграно
                    </h3>
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="number"
                        value={userHours}
                        onChange={(e) => {
                          const v = parseInt(e.target.value) || 0;
                          setUserHours(v);
                          saveData(userRating, v, review, gameStatus);
                        }}
                        className="w-20 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="0"
                      />
                      <span className="text-sm text-neutral-600">часов</span>
                    </div>
                    {userHours > 0 && (
                      <div className="text-sm text-neutral-600">Ты наиграл: {userHours}ч</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-neutral-50 rounded-xl p-6 mb-6 text-center">
                  <Lock className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
                  <p className="text-neutral-600">Войди, чтобы оценивать игры и указывать часы</p>
                </div>
              )}

              {/* Рецензия */}
              {authUser ? (
                <div className="bg-neutral-50 rounded-xl p-5">
                  <h3 className="font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-500" /> Твоя рецензия
                  </h3>
                  <textarea
                    value={review}
                    onChange={(e) => {
                      setReview(e.target.value);
                      saveData(userRating, userHours, e.target.value, gameStatus);
                      if (e.target.value.length > 10) addXp(XP_RULES.REVIEW);
                    }}
                    placeholder="Напиши своё мнение об игре..."
                    className="w-full bg-white border border-neutral-200 rounded-lg p-3 text-neutral-900 placeholder:text-neutral-400 min-h-[100px] resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {review.length > 0 && (
                    <div className="mt-2 text-right">
                      <span className="text-xs text-neutral-500">{review.length} символов</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-neutral-50 rounded-xl p-6 text-center">
                  <Lock className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
                  <p className="text-neutral-600">Войди, чтобы писать рецензии</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}