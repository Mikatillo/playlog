'use client';

import { Search, Filter, X, Star, Clock, MessageSquare, Trophy, TrendingUp, Zap, Loader2, Lock, Check, Heart, Gamepad, Monitor, Save } from 'lucide-react';
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

const platforms = ['Все', 'PC', 'PS5', 'Xbox', 'Switch'];

export default function Home() {
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
  const [translating, setTranslating] = useState(false);

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

  const openGame = async (game: Game) => {
    // Сначала показываем базовые данные
    setSelectedGame(game);
    setTranslating(false);
    
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

    // Затем загружаем полные данные (скриншоты, трейлер)
    try {
      const response = await fetch(`/api/games/${game.id}`);
      if (response.ok) {
        const rawData = await response.json();
        const fullGame = mapRawgGame(rawData);
        setSelectedGame(fullGame);
      }
    } catch (error) {
      console.error('Ошибка загрузки полных данных игры:', error);
    }
  };

  const closeGame = () => {
    setSelectedGame(null);
  };

  const saveAndClose = async () => {
    if (!selectedGame) return;
    
    await saveData(userRating, userHours, review, gameStatus);
    
    if (gameStatus !== 'none') {
      addXp(XP_RULES.ADD_GAME);
    }
    if (userRating > 0) {
      addXp(XP_RULES.RATE);
    }
    if (review.length > 10) {
      addXp(XP_RULES.REVIEW);
    }
    
    closeGame();
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

  const handleTranslate = async () => {
    if (!selectedGame?.descriptionRaw) return;
    setTranslating(true);
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selectedGame.descriptionRaw }),
      });
      const data = await response.json();
      if (data.translatedText) {
        setSelectedGame({
          ...selectedGame,
          descriptionRu: data.translatedText,
        });
      }
    } catch (error) {
      console.error('Translation error:', error);
    }
    setTranslating(false);
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadGames(nextPage, true);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header profile={profile} levelInfo={levelInfo} />

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
                        <span className="text-xs text-neutral-400 flex items-center gap-1 ml-auto">
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
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-5 space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="w-4 h-4 text-neutral-400" />
                <h2 className="font-semibold text-white">Фильтры</h2>
              </div>

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

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-neutral-800">
                <div>
                  <label className="text-xs font-medium text-neutral-400 mb-2 block">Платформа</label>
                  <div className="flex flex-wrap gap-2">
                    {platforms.map((platform) => (
                      <button
                        key={platform}
                        onClick={() => setSelectedPlatform(platform)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                          selectedPlatform === platform
                            ? 'bg-indigo-500 text-white'
                            : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                        }`}
                      >
                        {platform}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-neutral-400 mb-2 block">Сортировка</label>
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
                    <h1 className="text-3xl font-bold text-white mb-3">{selectedGame.title}</h1>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-lg text-sm font-medium">
                        {selectedGame.genre}
                      </span>
                      <span className="px-3 py-1 bg-neutral-800 text-neutral-300 rounded-lg text-sm font-medium">
                        {selectedGame.year}
                      </span>
                      <span className="px-3 py-1 bg-yellow-500/10 text-yellow-400 rounded-lg text-sm font-medium flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" /> {selectedGame.rating}
                      </span>
                    </div>
                    
                    {/* Краткое описание */}
                    <p className="text-neutral-400 leading-relaxed mb-4">{selectedGame.description}</p>
                    
                    {/* Развёрнутое описание с переводом */}
                    {selectedGame.descriptionRaw && (
                      <div className="mb-4">
                        <details className="group">
                          <summary className="text-indigo-400 cursor-pointer text-sm font-medium hover:text-indigo-300 transition list-none flex items-center gap-2">
                            <span>Показать полное описание</span>
                            <span className="text-xs text-neutral-500">(EN)</span>
                          </summary>
                          <div 
                            className="mt-3 text-neutral-400 leading-relaxed max-w-none"
                            dangerouslySetInnerHTML={{ __html: selectedGame.descriptionRaw }}
                          />
                        </details>
                        
                        {/* Кнопка перевода */}
                        {!selectedGame.descriptionRu && (
                          <button
                            onClick={handleTranslate}
                            disabled={translating}
                            className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1 disabled:opacity-50"
                          >
                            {translating ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Перевожу...
                              </>
                            ) : (
                              <>
                                🌐 Перевести на русский
                              </>
                            )}
                          </button>
                        )}
                        
                        {selectedGame.descriptionRu && (
                          <div className="mt-3">
                            <div className="text-xs text-neutral-500 mb-2 flex items-center gap-1">
                              🌐 Перевод на русский:
                            </div>
                            <p className="text-neutral-300 leading-relaxed">
                              {selectedGame.descriptionRu}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Трейлер */}
                  {selectedGame.trailer && (
                    <div className="bg-neutral-800 rounded-xl p-4">
                      <h3 className="text-sm font-medium text-neutral-400 mb-3 flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-indigo-500" /> Трейлер
                      </h3>
                      <div className="aspect-video rounded-lg overflow-hidden bg-black">
                        <iframe
                          src={selectedGame.trailer.replace('watch?v=', 'embed/')}
                          className="w-full h-full"
                          allowFullScreen
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                      </div>
                    </div>
                  )}

                  {/* Статистика */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-neutral-800 rounded-lg p-3 text-center">
                      <Star className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
                      <div className="font-semibold text-white">{selectedGame.rating}</div>
                      <div className="text-xs text-neutral-400">Рейтинг</div>
                    </div>
                    <div className="bg-neutral-800 rounded-lg p-3 text-center">
                      <Monitor className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
                      <div className="font-semibold text-white">{selectedGame.platforms.length}</div>
                      <div className="text-xs text-neutral-400">Платформ</div>
                    </div>
                    <div className="bg-neutral-800 rounded-lg p-3 text-center">
                      <Trophy className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                      <div className="font-semibold text-white">{selectedGame.year}</div>
                      <div className="text-xs text-neutral-400">Год</div>
                    </div>
                  </div>

                  {/* Платформы */}
                  <div>
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
                  {selectedGame.screenshots && selectedGame.screenshots.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-neutral-400 mb-3 flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-indigo-500" /> Скриншоты ({selectedGame.screenshots.length})
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {selectedGame.screenshots.map((shot) => (
                          <div key={shot.id} className="aspect-video rounded-lg overflow-hidden bg-neutral-800 group/shot cursor-pointer">
                            <img
                              src={shot.image}
                              alt={`Screenshot ${shot.id}`}
                              className="w-full h-full object-cover group-hover/shot:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Статусы */}
              {authUser ? (
                <div className="bg-neutral-800 rounded-xl p-5 mb-6">
                  <h2 className="font-semibold text-white mb-3">Добавить в список</h2>
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
                          : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
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
                          : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
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
                          : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      <Check className="w-4 h-4" /> Прошёл
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

              {/* Оценка и часы */}
              {authUser ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-neutral-800 rounded-xl p-5">
                    <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
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
                              : 'bg-neutral-900 border border-neutral-700 text-neutral-400 hover:bg-neutral-700'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                    {userRating > 0 && (
                      <div className="text-sm text-neutral-400">Твоя оценка: {userRating}/5</div>
                    )}
                  </div>

                  <div className="bg-neutral-800 rounded-xl p-5">
                    <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-500" /> Часов наиграно
                    </h3>
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="number"
                        value={userHours === 0 ? '' : userHours}
                        onChange={(e) => {
                          const v = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                          setUserHours(v);
                          saveData(userRating, v, review, gameStatus);
                        }}
                        className="w-20 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="0"
                      />
                      <span className="text-sm text-neutral-400">часов</span>
                    </div>
                    {userHours > 0 && (
                      <div className="text-sm text-neutral-400">Ты наиграл: {userHours}ч</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-neutral-800 rounded-xl p-6 mb-6 text-center">
                  <Lock className="w-8 h-8 text-neutral-500 mx-auto mb-2" />
                  <p className="text-neutral-400">Войди, чтобы оценивать игры и указывать часы</p>
                </div>
              )}

              {/* Рецензия */}
              {authUser ? (
                <div className="bg-neutral-800 rounded-xl p-5 mb-6">
                  <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
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
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-white placeholder:text-neutral-500 min-h-[100px] resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {review.length > 0 && (
                    <div className="mt-2 text-right">
                      <span className="text-xs text-neutral-500">{review.length} символов</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-neutral-800 rounded-xl p-6 text-center">
                  <Lock className="w-8 h-8 text-neutral-500 mx-auto mb-2" />
                  <p className="text-neutral-400">Войди, чтобы писать рецензии</p>
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
                    Добавить
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
    </div>
  );
}