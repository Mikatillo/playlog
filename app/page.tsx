'use client';

import {
  Search, Filter, X, Clock, MessageSquare, Trophy, TrendingUp,
  Zap, Loader2, Lock, Check, Heart, Gamepad, Monitor, Save,
  ChevronDown, ChevronUp, XCircle, Award,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Game, GameData, XP_RULES, calculateLevel, UserProfile } from '@/types/game';
import { mapRawgGame, RawgGame } from '@/lib/rawg';
import { supabase } from '@/lib/supabase';
import GameCard from '@/components/GameCard';
import Header from '@/components/Header';

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

export default function Home() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const suggestionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedGenre, setSelectedGenre] = useState('');
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
  const [gameStatus, setGameStatus] = useState<'none' | 'want' | 'playing' | 'completed' | 'dropped'>('none');
  const [saved, setSaved] = useState(false);
  const [xpGain, setXpGain] = useState<number | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [authUser, setAuthUser] = useState<any>(null);
  const [userGames, setUserGames] = useState<Map<number, GameData>>(new Map());
  const [profile, setProfile] = useState<UserProfile>({
    nickname: '',
    xp: 0,
    totalGames: 0,
    completedGames: 0,
    totalHours: 0,
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [screenshotsLoaded, setScreenshotsLoaded] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [descriptionRu, setDescriptionRu] = useState<string | null>(null);

  const levelInfo = calculateLevel(profile.xp);

  useEffect(() => {
    let cancelled = false;

    const loadUserData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (cancelled) return;
      setAuthUser(user);
      if (!user) return;

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

      if (gamesRes.data) {
        const map = new Map<number, GameData>();
        gamesRes.data.forEach((g) => {
          map.set(g.game_id, {
            rating: g.rating || 0,
            hours: g.hours || 0,
            review: g.review || '',
            status: g.status || 'none',
            xp: 0,
          });
        });
        setUserGames(map);
      }
    };

    loadUserData();
    return () => {
      cancelled = true;
    };
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
        setGames((prev) => (append ? [...prev, ...mappedGames] : mappedGames));
        setHasMore(data.next !== null);
      }
    } catch (error) {
      console.error('Ошибка загрузки:', error);
    }
    setLoading(false);
  };

  const handleInputChange = (value: string) => {
    setSearchInput(value);
    if (suggestionTimeoutRef.current) clearTimeout(suggestionTimeoutRef.current);
    if (value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    suggestionTimeoutRef.current = setTimeout(async () => {
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
  };

  const handleSearchSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchInput.trim().length > 0) {
      setShowSuggestions(false);
      setSearchQuery(searchInput.trim());
      setSearchMode('results');
      setLoading(true);
      try {
        const response = await fetch(
          `/api/games/search?search=${encodeURIComponent(searchInput.trim())}`,
        );
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
    setPage(1);
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
    setProfile((prev) => ({ ...prev, xp: prev.xp + amount }));
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

  const openGame = async (game: Game) => {
    setSelectedGame(game);
    setDescriptionExpanded(false);
    setScreenshotsLoaded(false);
    setTranslating(false);
    setDescriptionRu(null);

    const data = userGames.get(game.id);
    if (data) {
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

    try {
      const response = await fetch(`/api/games/${game.id}?full=true`);
      if (response.ok) {
        const rawData = await response.json();
        const fullGame = mapRawgGame(rawData);
        setSelectedGame(fullGame);
        setScreenshotsLoaded(true);
        if (fullGame.descriptionRaw) {
          translateDescription(fullGame.descriptionRaw, game.id);
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки полных данных игры:', error);
      setScreenshotsLoaded(true);
    }
  };

  const closeGame = () => {
    setSelectedGame(null);
    setDescriptionExpanded(false);
    setScreenshotsLoaded(false);
    setDescriptionRu(null);
  };

  const saveData = async (
    newRating: number,
    newHours: number,
    newReview: string,
    newStatus: 'none' | 'want' | 'playing' | 'completed' | 'dropped',
  ) => {
    if (!selectedGame || !authUser) return;

    await supabase.from('user_games').upsert(
      {
        user_id: authUser.id,
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
      newMap.set(selectedGame.id, {
        rating: newRating,
        hours: newHours,
        review: newReview,
        status: newStatus,
        xp: 0,
      });
      return newMap;
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const saveAndClose = async () => {
    if (!selectedGame) return;
    await saveData(userRating, userHours, review, gameStatus);
    if (gameStatus === 'completed') addXp(XP_RULES.COMPLETE);
    else if (gameStatus === 'dropped') addXp(XP_RULES.DROP);
    else if (gameStatus !== 'none') addXp(XP_RULES.ADD_GAME);
    if (userRating > 0) addXp(XP_RULES.RATE);
    if (review.length > 10) addXp(XP_RULES.REVIEW);
    closeGame();
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadGames(nextPage, true);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header
        profile={profile}
        levelInfo={levelInfo}
        userId={authUser?.id}
        onProfileUpdate={(updated) => setProfile((prev) => ({ ...prev, ...updated }))}
        achievementsStats={{
          total: userGames.size,
          completed: Array.from(userGames.values()).filter((d) => d.status === 'completed').length,
          playing: Array.from(userGames.values()).filter((d) => d.status === 'playing').length,
          want: Array.from(userGames.values()).filter((d) => d.status === 'want').length,
          dropped: Array.from(userGames.values()).filter((d) => d.status === 'dropped').length,
          totalHours: Array.from(userGames.values()).reduce((s, d) => s + (d.hours || 0), 0),
          ratedGames: Array.from(userGames.values()).filter((d) => d.rating > 0).length,
          reviewsCount: Array.from(userGames.values()).filter(
            (d) => d.review && d.review.length > 0,
          ).length,
        }}
      />
      {xpGain && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium z-50 shadow-lg animate-bounce">
          <Zap className="w-4 h-4 inline mr-1" /> +{xpGain} XP!
        </div>
      )}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <main className="space-y-6">
          {/* Поиск */}
          <div className="relative">
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 flex items-center gap-3 shadow-sm">
              <Search className="w-5 h-5 text-neutral-500 flex-shrink-0" />
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
                className="flex-1 bg-transparent text-white placeholder:text-neutral-500 focus:outline-none text-base"
              />
              {(searchInput || searchMode === 'results') && (
                <button
                  onClick={handleReset}
                  className="p-2 hover:bg-neutral-800 rounded-lg transition"
                >
                  <X className="w-4 h-4 text-neutral-400" />
                </button>
              )}
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute left-0 right-0 top-full mt-2 bg-neutral-900 rounded-xl border border-neutral-800 shadow-lg z-50 overflow-hidden"
              >
                {suggestions.map((game) => (
                  <div
                    key={game.id}
                    onClick={() => handleSuggestionClick(game)}
                    className="flex items-center gap-3 p-3 hover:bg-neutral-800 cursor-pointer border-b border-neutral-800 last:border-b-0"
                  >
                    <img
                      src={game.cover}
                      alt={game.title}
                      className="w-12 h-16 object-cover rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://via.placeholder.com/48x64/171717/525252?text=?';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-white truncate">{game.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-neutral-400">{game.genre}</span>
                        <span className="text-xs text-neutral-600">•</span>
                        <span className="text-xs text-neutral-400">{game.year}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Фильтры */}
          {searchMode === 'browse' && (
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-neutral-800/50 transition"
              >
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-neutral-400" />
                  <h2 className="font-semibold text-white">Фильтры</h2>
                  {selectedGenre && (
                    <span className="text-xs bg-indigo-500 text-white px-2 py-0.5 rounded-full">
                      Активно
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
                    <label className="text-xs font-medium text-neutral-400 mb-2 block">Жанр</label>
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
                              : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                          }`}
                        >
                          {genre.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="pt-4 border-t border-neutral-800">
                    <label className="text-xs font-medium text-neutral-400 mb-2 block">
                      Сортировка
                    </label>
                    <select
                      value={sortBy}
                      onChange={(e) => {
                        setSortBy(e.target.value);
                        setPage(1);
                      }}
                      className="px-3 py-1.5 bg-neutral-800 border-0 rounded-lg text-sm text-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="-added">Популярность</option>
                      <option value="-rating">Рейтинг</option>
                      <option value="-released">Дата выхода</option>
                      <option value="-metacritic">Metacritic</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Результаты */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-500" />
                {searchMode === 'results' ? `Результаты: "${searchQuery}"` : 'Популярные игры'}
              </h2>
            </div>
            {loading && games.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <span className="ml-3 text-neutral-400">Загрузка...</span>
              </div>
            ) : games.length === 0 ? (
              <div className="text-center py-20 bg-neutral-900 rounded-xl border border-neutral-800">
                <p className="text-neutral-400">Ничего не найдено</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {games.map((game) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      onClick={() => openGame(game)}
                      userGameData={userGames.get(game.id)}
                      isAuthenticated={!!authUser}
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

      {/* Модальное окно игры */}
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
                      <div className="text-sm text-white font-medium">Переводим описание...</div>
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
              {authUser ? (
                <div className="bg-neutral-800 rounded-xl p-5 mb-6">
                  <h2 className="font-semibold text-white mb-3">Добавить в список</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <button
                      onClick={() => setGameStatus('want')}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
                        gameStatus === 'want'
                          ? 'bg-rose-500 text-white'
                          : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      <Heart className="w-4 h-4" /> Хочу
                    </button>
                    <button
                      onClick={() => setGameStatus('playing')}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
                        gameStatus === 'playing'
                          ? 'bg-blue-500 text-white'
                          : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      <Gamepad className="w-4 h-4" /> Играю
                    </button>
                    <button
                      onClick={() => setGameStatus('completed')}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
                        gameStatus === 'completed'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      <Check className="w-4 h-4" /> Прошёл
                    </button>
                    <button
                      onClick={() => setGameStatus('dropped')}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
                        gameStatus === 'dropped'
                          ? 'bg-neutral-500 text-white'
                          : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      <XCircle className="w-4 h-4" /> Заброшено
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-neutral-800 rounded-xl p-6 mb-6 text-center">
                  <Lock className="w-8 h-8 text-neutral-500 mx-auto mb-2" />
                  <p className="text-neutral-400 mb-3">Войди, чтобы добавлять игры в список</p>
                  <a
                    href="/auth"
                    className="inline-block px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition"
                  >
                    Войти
                  </a>
                </div>
              )}

              {/* Оценка */}
              {authUser && (
                <div className="bg-neutral-800 rounded-xl p-5 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-indigo-500" /> Твоя оценка
                    </h3>
                    <span className={`text-2xl font-bold ${getRatingColor(userRating)}`}>
                      {userRating > 0 ? `${userRating}/10` : '—'}
                    </span>
                  </div>
                  <div className="relative">
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
                    <div className="flex justify-between text-xs text-neutral-500 mt-2">
                      <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span>
                      <span>5</span><span>6</span><span>7</span><span>8</span><span>9</span>
                      <span>10</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Часы */}
              {authUser && (
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
                      value={userHours === 0 ? '' : userHours}
                      onChange={(e) => {
                        const v = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                        setUserHours(v);
                      }}
                      className="w-24 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="0"
                    />
                    <span className="text-sm text-neutral-400">часов</span>
                  </div>
                </div>
              )}

              {/* Рецензия */}
              {authUser && (
                <div className="bg-neutral-800 rounded-xl p-5 mb-6">
                  <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-500" /> Твоя рецензия
                  </h3>
                  <textarea
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    placeholder="Напиши своё мнение об игре..."
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-white placeholder:text-neutral-500 min-h-[100px] resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {review.length > 0 && (
                    <div className="mt-2 text-right">
                      <span className="text-xs text-neutral-500">{review.length} символов</span>
                    </div>
                  )}
                </div>
              )}

              {/* Кнопки */}
              {authUser && (
                <div className="flex gap-3 pt-4 border-t border-neutral-800">
                  <button
                    onClick={saveAndClose}
                    className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-medium py-3 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Сохранить
                  </button>
                  <button
                    onClick={closeGame}
                    className="px-6 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium py-3 rounded-lg transition"
                  >
                    Отмена
                  </button>
                </div>
              )}
            </div>
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