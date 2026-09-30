'use client';

import { Filter, X, Check, MessageSquare, Star, Clock, Monitor, Trophy, TrendingUp, Download, Upload, Zap, Loader2, Gamepad2, Search, Lock } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Game, GameData, XP_RULES, calculateLevel, UserProfile } from '@/types/game';
import { mapRawgGame, RawgGame } from '@/lib/rawg';
import { supabase } from '@/lib/supabase';
import GameCard from '@/components/GameCard';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';

const genres = [
  { id: '', name: 'All' },
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

const platforms = ["All", "PC", "PS5", "Xbox", "Switch"];

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
  const [selectedGenre, setSelectedGenre] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchMode, setSearchMode] = useState<'browse' | 'results'>('browse');
  const [suggestions, setSuggestions] = useState<Game[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sortBy, setSortBy] = useState<string>("-added");
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
    totalHours: 0 
  });

  const levelInfo = calculateLevel(profile.xp);

  // Загружаем текущего пользователя при монтировании
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
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) &&
          searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
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

  // Обновление XP и профиля в Supabase
  const addXp = async (amount: number) => {
    setProfile(prev => {
      const newProfile = { ...prev, xp: prev.xp + amount };
      localStorage.setItem('user_profile', JSON.stringify(newProfile));
      return newProfile;
    });
    setXpGain(amount);
    setTimeout(() => setXpGain(null), 2000);

    // Обновляем в Supabase
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
    games.forEach(game => {
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

  const saveData = async (newRating: number, newHours: number, newReview: string, newStatus: 'none' | 'want' | 'playing' | 'completed') => {
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

    // Сохраняем в Supabase если авторизован
    if (authUser) {
      await supabase
        .from('user_games')
        .upsert({
          user_id: authUser.id,
          game_id: selectedGame.id,
          rating: newRating,
          hours: newHours,
          review: newReview,
          status: newStatus,
        }, {
          onConflict: 'user_id,game_id'
        });
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadGames(nextPage, true);
  };

  // Проверка авторизации перед действием
  const requireAuth = () => {
    if (!authUser) {
      alert('Войди в аккаунт, чтобы оценивать игры и писать рецензии!');
      return false;
    }
    return true;
  };

  return (
    <div className="min-h-screen bg-[#0f0f1e] text-[#fcfcfc]">
      <div className="retro-grid"></div>

      <Header profile={profile} levelInfo={levelInfo} />

      <div className="header-line"></div>

      {xpGain && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-[#ffec27] text-[#0f0f1e] px-4 py-2 font-pixel text-xs z-50 border-2 border-[#ffec27] animate-bounce">
          <Zap className="w-4 h-4 inline mr-1" /> +{xpGain} XP!
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6 relative z-10">
        {/* Sidebar только для авторизованных */}
        {authUser && <Sidebar profile={profile} levelInfo={levelInfo} />}

        <main className="flex-1 space-y-6">
          {/* Приветствие только для авторизованных */}
          {authUser && (
            <div className="bg-[#1a1a2e] border-2 border-[#b142f5] p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#b142f5] flex items-center justify-center">
                    <Gamepad2 className="w-7 h-7 text-[#ffec27]" />
                  </div>
                  <div>
                    <h2 className="font-pixel text-sm text-[#ffec27]">
                      ПРИВЕТ, {profile.nickname.toUpperCase()}!
                    </h2>
                    <p className="text-sm text-[#747474]">
                      LVL {levelInfo.level} • {profile.xp} XP • {profile.completedGames} игр пройдено
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={exportData}
                    className="font-pixel text-[10px] bg-[#29adff] text-[#0f0f1e] px-3 py-2 hover:bg-[#5bc0ff] flex items-center gap-2"
                  >
                    <Download className="w-3 h-3" /> ЭКСПОРТ
                  </button>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="font-pixel text-[10px] bg-[#b142f5] text-[#fcfcfc] px-3 py-2 hover:bg-[#c966ff] flex items-center gap-2"
                  >
                    <Upload className="w-3 h-3" /> ИМПОРТ
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

          {/* ПОИСК */}
          <div className="relative bg-[#1a1a2e] border-2 border-[#29adff] p-4">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-[#29adff] flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="ВВЕДИ НАЗВАНИЕ ИГРЫ..."
                value={searchInput}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleSearchSubmit}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                className="flex-1 bg-[#0f0f1e] border-2 border-[#747474] px-4 py-3 font-pixel text-sm text-[#fcfcfc] focus:outline-none focus:border-[#29adff] placeholder:text-[#747474]"
              />
              {(searchInput || searchMode === 'results') && (
                <button
                  onClick={handleReset}
                  className="bg-[#ff004d] px-4 py-3 font-pixel text-[10px] text-white hover:bg-[#ff3366] flex-shrink-0"
                >
                  СБРОС
                </button>
              )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div 
                ref={suggestionsRef}
                className="absolute left-4 right-4 top-full mt-1 bg-[#1a1a2e] border-2 border-[#29adff] z-50 max-h-80 overflow-y-auto"
              >
                {suggestions.map((game) => (
                  <div
                    key={game.id}
                    onClick={() => handleSuggestionClick(game)}
                    className="flex items-center gap-3 p-3 hover:bg-[#0f0f1e] cursor-pointer border-b border-[#747474] last:border-b-0"
                  >
                    <img src={game.cover} alt={game.title} className="w-10 h-14 object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/40x56/1a1a2e/747474?text=?'; }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-pixel text-[10px] text-[#fcfcfc] truncate">{game.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-pixel text-[8px] text-[#b142f5]">{game.genre}</span>
                        <span className="font-pixel text-[8px] text-[#747474]">{game.year}</span>
                        <span className="font-pixel text-[8px] text-[#ffec27] flex items-center gap-1">
                          <Star className="w-2 h-2 fill-[#ffec27]" /> {game.rating}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                <div 
                  onClick={() => {
                    if (searchInput.trim()) {
                      handleSearchSubmit({ key: 'Enter' } as React.KeyboardEvent<HTMLInputElement>);
                    }
                  }}
                  className="p-3 bg-[#0f0f1e] hover:bg-[#1a1a2e] cursor-pointer text-center border-t-2 border-[#29adff]"
                >
                  <span className="font-pixel text-[10px] text-[#29adff]">
                    НАЖМИ ENTER ДЛЯ ПОИСКА "{searchInput.toUpperCase()}"
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ФИЛЬТРЫ */}
          {searchMode === 'browse' && (
            <section className="bg-[#1a1a2e] border-2 border-[#747474] p-4">
              <div className="space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-[#ffec27]" />
                    <h2 className="font-pixel text-xs text-[#ffec27]">ЖАНРЫ</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {genres.map((genre) => (
                      <button
                        key={genre.id}
                        onClick={() => { setSelectedGenre(genre.id); setPage(1); }}
                        className={`font-pixel text-[10px] px-3 py-2 border-2 transition ${
                          selectedGenre === genre.id
                            ? "bg-[#ffec27] text-[#0f0f1e] border-[#ffec27]"
                            : "bg-[#0f0f1e] text-[#fcfcfc] border-[#747474] hover:border-[#ffec27]"
                        }`}
                      >
                        {genre.name.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-3 border-t border-[#747474]">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-[#29adff]" />
                    <h2 className="font-pixel text-xs text-[#29adff]">ПЛАТФОРМЫ</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {platforms.map((platform) => (
                      <button
                        key={platform}
                        onClick={() => setSelectedPlatform(platform)}
                        className={`font-pixel text-[10px] px-3 py-2 border-2 transition ${
                          selectedPlatform === platform
                            ? "bg-[#29adff] text-[#0f0f1e] border-[#29adff]"
                            : "bg-[#0f0f1e] text-[#fcfcfc] border-[#747474] hover:border-[#29adff]"
                        }`}
                      >
                        {platform.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-pixel text-[10px] text-[#747474]">СОРТ:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                      className="font-pixel text-[10px] bg-[#0f0f1e] border-2 border-[#747474] px-2 py-1 text-[#fcfcfc]"
                    >
                      <option value="-added">ПОПУЛЯРНОСТЬ</option>
                      <option value="-rating">РЕЙТИНГ</option>
                      <option value="-released">ДАТА ВЫХОДА</option>
                      <option value="-metacritic">METACRITIC</option>
                    </select>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* РЕЗУЛЬТАТЫ */}
          <section>
            <h2 className="font-pixel text-xs text-[#29adff] mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> 
              {searchMode === 'results' 
                ? `РЕЗУЛЬТАТЫ ПОИСКА: "${searchQuery.toUpperCase()}" (${games.length})` 
                : 'ИГРЫ'} ({games.length})
            </h2>

            {loading && games.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-[#b142f5] animate-spin" />
                <span className="font-pixel text-xs ml-3 text-[#747474]">ЗАГРУЗКА...</span>
              </div>
            ) : games.length === 0 ? (
              <div className="text-center py-20 bg-[#1a1a2e] border-2 border-[#747474]">
                <p className="font-pixel text-sm text-[#747474]">НИЧЕГО НЕ НАЙДЕНО</p>
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
                      className="font-pixel text-xs bg-[#b142f5] text-[#fcfcfc] px-6 py-3 hover:bg-[#c966ff] disabled:opacity-50"
                    >
                      {loading ? 'ЗАГРУЗКА...' : 'ПОКАЗАТЬ ЕЩЁ'}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </main>
      </div>

      {selectedGame && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#1a1a2e] border-4 border-[#b142f5] max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={closeGame}
              className="absolute top-4 right-4 bg-[#ff004d] w-10 h-10 flex items-center justify-center font-pixel text-xs hover:bg-[#ff3366] z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {saved && (
              <div className="fixed top-4 right-20 bg-[#00e436] text-[#0f0f1e] px-4 py-2 font-pixel text-xs z-50">
                СОХРАНЕНО!
              </div>
            )}

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="md:col-span-1">
                  <div className="bg-[#0f0f1e] border-4 border-[#ff004d] p-2">
                    <img src={selectedGame.cover} alt={selectedGame.title} className="w-full aspect-[2/3] object-cover" />
                  </div>
                </div>

                <div className="md:col-span-2 space-y-4">
                  <div>
                    <h1 className="font-pixel text-xl md:text-2xl text-[#ffec27] mb-2 text-glow">
                      {selectedGame.title.toUpperCase()}
                    </h1>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="font-pixel text-[10px] bg-[#b142f5] px-3 py-1">{selectedGame.genre}</span>
                      <span className="font-pixel text-[10px] bg-[#29adff] px-3 py-1">{selectedGame.year}</span>
                      <span className="font-pixel text-[10px] bg-[#00e436] text-[#0f0f1e] px-3 py-1 flex items-center gap-1">
                        <Star className="w-3 h-3 fill-[#0f0f1e]" /> {selectedGame.rating}
                      </span>
                    </div>
                    <p className="text-lg text-[#fcfcfc] leading-relaxed">{selectedGame.description}</p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <div className="bg-[#0f0f1e] border-2 border-[#ffec27] p-2 text-center">
                      <Star className="w-4 h-4 text-[#ffec27] mx-auto mb-1" />
                      <div className="font-pixel text-sm text-[#ffec27]">{selectedGame.rating}</div>
                      <div className="font-pixel text-[7px] text-[#747474]">РЕЙТИНГ</div>
                    </div>
                    <div className="bg-[#0f0f1e] border-2 border-[#29adff] p-2 text-center">
                      <Monitor className="w-4 h-4 text-[#29adff] mx-auto mb-1" />
                      <div className="font-pixel text-xs text-[#29adff]">{selectedGame.platforms.length}</div>
                      <div className="font-pixel text-[7px] text-[#747474]">ПЛАТФОРМ</div>
                    </div>
                    <div className="bg-[#0f0f1e] border-2 border-[#b142f5] p-2 text-center">
                      <Trophy className="w-4 h-4 text-[#b142f5] mx-auto mb-1" />
                      <div className="font-pixel text-sm text-[#b142f5]">{selectedGame.year}</div>
                      <div className="font-pixel text-[7px] text-[#747474]">ГОД</div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-pixel text-[9px] text-[#747474] mb-2">ПЛАТФОРМЫ:</h3>
                    <div className="flex gap-2 flex-wrap">
                      {selectedGame.platforms.map((platform) => (
                        <div key={platform} className="bg-[#0f0f1e] border-2 border-[#747474] px-3 py-1 font-pixel text-[9px]">
                          {platform}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Кнопки списков - только для авторизованных */}
              {authUser ? (
                <div className="bg-[#0f0f1e] border-2 border-[#00e436] p-4 mb-4">
                  <h2 className="font-pixel text-xs text-[#00e436] mb-3">ДОБАВИТЬ В СПИСОК</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <button
                      onClick={() => { setGameStatus('want'); saveData(userRating, userHours, review, 'want'); addXp(XP_RULES.ADD_GAME); }}
                      className={`font-pixel text-[10px] px-3 py-2 border-2 transition ${
                        gameStatus === 'want' ? 'bg-[#ffec27] text-[#0f0f1e] border-[#ffec27]' : 'bg-[#1a1a2e] text-[#fcfcfc] border-[#747474] hover:border-[#ffec27]'
                      }`}
                    >
                      ХОЧУ ПРОЙТИ
                    </button>
                    <button
                      onClick={() => { setGameStatus('playing'); saveData(userRating, userHours, review, 'playing'); addXp(XP_RULES.ADD_GAME); }}
                      className={`font-pixel text-[10px] px-3 py-2 border-2 transition ${
                        gameStatus === 'playing' ? 'bg-[#29adff] text-[#0f0f1e] border-[#29adff]' : 'bg-[#1a1a2e] text-[#fcfcfc] border-[#747474] hover:border-[#29adff]'
                      }`}
                    >
                      В ПРОЦЕССЕ
                    </button>
                    <button
                      onClick={() => { setGameStatus('completed'); saveData(userRating, userHours, review, 'completed'); addXp(XP_RULES.COMPLETE); }}
                      className={`font-pixel text-[10px] px-3 py-2 border-2 transition ${
                        gameStatus === 'completed' ? 'bg-[#00e436] text-[#0f0f1e] border-[#00e436]' : 'bg-[#1a1a2e] text-[#fcfcfc] border-[#747474] hover:border-[#00e436]'
                      }`}
                    >
                      <Check className="w-3 h-3 inline mr-1" /> ПРОШЁЛ
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-[#0f0f1e] border-2 border-[#747474] p-4 mb-4 text-center">
                  <Lock className="w-8 h-8 text-[#747474] mx-auto mb-2" />
                  <p className="font-pixel text-xs text-[#747474] mb-2">ВОЙДИ, ЧТОБЫ ДОБАВЛЯТЬ ИГРЫ В СПИСОК</p>
                  <a href="/auth" className="inline-block bg-[#00e436] text-[#0f0f1e] font-pixel text-xs px-4 py-2 hover:bg-[#00ff40]">
                    ВОЙТИ
                  </a>
                </div>
              )}

              {/* Оценка и часы - только для авторизованных */}
              {authUser ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-[#0f0f1e] border-2 border-[#ffec27] p-4">
                    <h3 className="font-pixel text-[10px] text-[#ffec27] mb-3 flex items-center gap-2">
                      <Trophy className="w-3 h-3" /> ТВОЯ ОЦЕНКА
                    </h3>
                    <div className="flex gap-2 mb-3 flex-wrap">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          onClick={() => { setUserRating(num); saveData(num, userHours, review, gameStatus); addXp(XP_RULES.RATE); }}
                          className={`w-10 h-10 font-pixel text-sm border-2 transition ${
                            userRating >= num ? 'bg-[#ffec27] text-[#0f0f1e] border-[#ffec27]' : 'bg-[#1a1a2e] text-[#747474] border-[#747474] hover:border-[#ffec27]'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                    {userRating > 0 && (
                      <div className="font-pixel text-xs text-[#ffec27]">Твоя оценка: {userRating}/5</div>
                    )}
                  </div>

                  <div className="bg-[#0f0f1e] border-2 border-[#00e436] p-4">
                    <h3 className="font-pixel text-[10px] text-[#00e436] mb-3 flex items-center gap-2">
                      <Clock className="w-3 h-3" /> ЧАСОВ НАИГРАНО
                    </h3>
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="number"
                        value={userHours}
                        onChange={(e) => { const v = parseInt(e.target.value) || 0; setUserHours(v); saveData(userRating, v, review, gameStatus); }}
                        className="w-20 bg-[#1a1a2e] border-2 border-[#747474] px-2 py-1 font-pixel text-xs text-[#fcfcfc]"
                        placeholder="0"
                      />
                      <span className="font-pixel text-xs text-[#747474]">часов</span>
                    </div>
                    {userHours > 0 && (
                      <div className="font-pixel text-xs text-[#00e436]">Ты наиграл: {userHours}ч</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-[#0f0f1e] border-2 border-[#747474] p-4 mb-4 text-center">
                  <Lock className="w-8 h-8 text-[#747474] mx-auto mb-2" />
                  <p className="font-pixel text-xs text-[#747474]">ВОЙДИ, ЧТОБЫ ОЦЕНИВАТЬ ИГРЫ И УКАЗЫВАТЬ ЧАСЫ</p>
                </div>
              )}

              {/* Рецензия - только для авторизованных */}
              {authUser ? (
                <div className="bg-[#0f0f1e] border-2 border-[#b142f5] p-4">
                  <h3 className="font-pixel text-[10px] text-[#b142f5] mb-3 flex items-center gap-2">
                    <MessageSquare className="w-3 h-3" /> ТВОЯ РЕЦЕНЗИЯ
                  </h3>
                  <textarea
                    value={review}
                    onChange={(e) => { setReview(e.target.value); saveData(userRating, userHours, e.target.value, gameStatus); if (e.target.value.length > 10) addXp(XP_RULES.REVIEW); }}
                    placeholder="Напиши своё мнение об игре..."
                    className="w-full bg-[#1a1a2e] border-2 border-[#747474] p-2 font-pixel text-[10px] text-[#fcfcfc] min-h-[80px] resize-y"
                  />
                  {review.length > 0 && (
                    <div className="mt-2 text-right">
                      <span className="font-pixel text-[8px] text-[#747474]">{review.length} символов</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-[#0f0f1e] border-2 border-[#747474] p-4 text-center">
                  <Lock className="w-8 h-8 text-[#747474] mx-auto mb-2" />
                  <p className="font-pixel text-xs text-[#747474]">ВОЙДИ, ЧТОБЫ ПИСАТЬ РЕЦЕНЗИИ</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}