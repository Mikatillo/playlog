'use client';

import { useState, useEffect, useMemo } from 'react';
import { Heart, Gamepad, Check, Trophy, Star, Clock, Award, Flame, Zap, Crown, Loader2, Lock, X, MessageSquare, Monitor, Trash2, AlertTriangle } from 'lucide-react';
import { Game, GameData, calculateLevel, XP_RULES } from '@/types/game';
import { mapRawgGame, RawgGame } from '@/lib/rawg';
import { supabase } from '@/lib/supabase';
import GameCard from '@/components/GameCard';
import Header from '@/components/Header';

type TabType = 'all' | 'want' | 'playing' | 'completed';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: any;
  unlocked: boolean;
  color: string;
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
    totalHours: 0 
  });
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalRating, setModalRating] = useState(0);
  const [modalHours, setModalHours] = useState(0);
  const [modalReview, setModalReview] = useState('');
  const [modalStatus, setModalStatus] = useState<'none' | 'want' | 'playing' | 'completed'>('none');
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setAuthUser(null);
        setLoading(false);
        return;
      }

      setAuthUser(user);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile({
          nickname: profileData.nickname || user.email?.split('@')[0] || 'Игрок',
          xp: profileData.xp || 0,
          totalGames: profileData.total_games || 0,
          completedGames: profileData.completed_games || 0,
          totalHours: profileData.total_hours || 0,
        });
      }

      const { data: gamesData } = await supabase
        .from('user_games')
        .select('*');

      if (gamesData && gamesData.length > 0) {
        const saved = new Map<number, GameData>();
        const gameIds: number[] = [];
        
        gamesData.forEach(g => {
          saved.set(g.game_id, {
            rating: g.rating || 0,
            hours: g.hours || 0,
            review: g.review || '',
            status: g.status || 'none',
            xp: 0,
          });
          gameIds.push(g.game_id);
        });
        
        setUserGames(saved);
        await loadGames(gameIds);
      } else {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const loadGames = async (ids: number[]) => {
    setLoading(true);
    try {
      const loadedGames: Game[] = [];
      for (const id of ids) {
        try {
          const response = await fetch(`/api/games/${id}`);
          if (response.ok) {
            const data: RawgGame = await response.json();
            loadedGames.push(mapRawgGame(data));
          }
        } catch (err) {
          console.error(`Ошибка загрузки игры ${id}:`, err);
        }
      }
      setGames(loadedGames);
    } catch (error) {
      console.error('Ошибка загрузки игр:', error);
    }
    setLoading(false);
  };

  const levelInfo = calculateLevel(profile.xp);

  const getGameList = (status: 'want' | 'playing' | 'completed') => {
    return games.filter(game => {
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
      filtered = filtered.filter(game => 
        game.title.toLowerCase().includes(searchInput.toLowerCase())
      );
    }
    return filtered;
  }, [activeTab, searchInput, games, userGames]);

  const stats = useMemo(() => {
    const completed = getGameList('completed');
    const playing = getGameList('playing');
    const want = getGameList('want');
    const totalHours = Array.from(userGames.values()).reduce((sum, data) => sum + (data.hours || 0), 0);
    const ratedGames = Array.from(userGames.values()).filter(d => d.rating > 0);
const avgRating = ratedGames.length > 0 
  ? (ratedGames.reduce((sum, data) => sum + data.rating, 0) / ratedGames.length).toFixed(1)
  : '—';

    return {
      total: userGames.size,
      completed: completed.length,
      playing: playing.length,
      want: want.length,
      totalHours,
      avgRating,
    };
  }, [userGames, games]);

  const achievements: Achievement[] = [
    { id: 'first_game', title: 'ПЕРВАЯ КРОВЬ', description: 'Добавь первую игру', icon: Heart, unlocked: stats.total >= 1, color: '#f43f5e' },
    { id: 'collector', title: 'КОЛЛЕКЦИОНЕР', description: 'Добавь 10 игр', icon: Crown, unlocked: stats.total >= 10, color: '#eab308' },
    { id: 'finisher', title: 'ФИНИШЁР', description: 'Пройди 5 игр', icon: Check, unlocked: stats.completed >= 5, color: '#10b981' },
    { id: 'hardcore', title: 'ХАРДКОРЩИК', description: 'Наиграй 100 часов', icon: Flame, unlocked: stats.totalHours >= 100, color: '#f43f5e' },
    { id: 'critic', title: 'КРИТИК', description: 'Оцени 5 игр', icon: Star, unlocked: Array.from(userGames.values()).filter(d => d.rating > 0).length >= 5, color: '#3b82f6' },
    { id: 'marathon', title: 'МАРАФОНЕЦ', description: 'Наиграй 500 часов', icon: Zap, unlocked: stats.totalHours >= 500, color: '#a855f7' },
  ];

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  const tabs: { id: TabType; label: string; icon: any; count: number }[] = [
    { id: 'all', label: 'Все', icon: Trophy, count: stats.total },
    { id: 'want', label: 'Хочу пройти', icon: Heart, count: stats.want },
    { id: 'playing', label: 'В процессе', icon: Gamepad, count: stats.playing },
    { id: 'completed', label: 'Прошёл', icon: Check, count: stats.completed },
  ];

  const openGame = async (game: Game) => {
    setSelectedGame(game);
    setModalLoading(true);
    setShowDeleteConfirm(false);
    
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
    
    setModalLoading(false);
  };

  const closeGame = () => {
    setSelectedGame(null);
    setShowDeleteConfirm(false);
  };

  const saveModalData = async () => {
    if (!selectedGame || !authUser) return;
    
    const data: GameData = {
      rating: modalRating,
      hours: modalHours,
      review: modalReview,
      status: modalStatus,
      xp: 0,
    };
    
    await supabase
      .from('user_games')
      .upsert(
        {
          user_id: authUser.id,
          game_id: selectedGame.id,
          rating: modalRating,
          hours: modalHours,
          review: modalReview,
          status: modalStatus,
        },
        { onConflict: 'user_id,game_id' }
      );
    
    setUserGames(prev => {
      const newMap = new Map(prev);
      newMap.set(selectedGame.id, data);
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
    
    setUserGames(prev => {
      const newMap = new Map(prev);
      newMap.delete(selectedGame.id);
      return newMap;
    });
    
    setGames(prev => prev.filter(g => g.id !== selectedGame.id));
    
    closeGame();
  };

  if (!authUser && !loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Header />
        <div className="max-w-7xl mx-auto px-6 py-20 text-center">
          <Lock className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-4">Доступ закрыт</h1>
          <p className="text-lg text-neutral-400 mb-6">Войди в аккаунт, чтобы видеть свои игры</p>
          <a href="/auth" className="inline-block bg-indigo-500 text-white font-medium px-6 py-3 rounded-lg hover:bg-indigo-600 transition">
            Войти
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header profile={profile} levelInfo={levelInfo} />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Мои игры</h1>
          <p className="text-neutral-400">Твоя личная коллекция и достижения</p>
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

        {/* Статистика */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
            <Trophy className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
            <div className="text-xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-neutral-400">Всего</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
            <Check className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            <div className="text-xl font-bold text-white">{stats.completed}</div>
            <div className="text-xs text-neutral-400">Пройдено</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
            <Gamepad className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <div className="text-xl font-bold text-white">{stats.playing}</div>
            <div className="text-xs text-neutral-400">В процессе</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
            <Heart className="w-5 h-5 text-rose-500 mx-auto mb-1" />
            <div className="text-xl font-bold text-white">{stats.want}</div>
            <div className="text-xs text-neutral-400">Хочу</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
            <Clock className="w-5 h-5 text-purple-500 mx-auto mb-1" />
            <div className="text-xl font-bold text-white">{stats.totalHours}h</div>
            <div className="text-xs text-neutral-400">Всего часов</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
            <Star className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
            <div className="text-xl font-bold text-white">{stats.avgRating}</div>
            <div className="text-xs text-neutral-400">Ср. оценка</div>
          </div>
        </div>

        {/* Достижения */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 mb-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-indigo-500" /> Достижения ({unlockedCount}/{achievements.length})
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {achievements.map((achievement) => {
              const Icon = achievement.icon;
              return (
                <div
                  key={achievement.id}
                  className={`bg-neutral-800 border rounded-lg p-3 text-center transition ${
                    achievement.unlocked ? 'border-neutral-600 opacity-100' : 'border-neutral-800 opacity-40'
                  }`}
                >
                  <Icon className="w-5 h-5 mx-auto mb-1" style={{ color: achievement.unlocked ? achievement.color : '#737373' }} />
                  <div className="text-xs font-medium mb-1" style={{ color: achievement.unlocked ? achievement.color : '#737373' }}>
                    {achievement.title}
                  </div>
                  <div className="text-[10px] text-neutral-500 leading-tight">
                    {achievement.description}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Вкладки */}
        <div className="flex flex-wrap gap-2 mb-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${
                  activeTab === tab.id
                    ? 'bg-indigo-500 text-white'
                    : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label} ({tab.count})
              </button>
            );
          })}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredGames.map((game) => {
              const data = userGames.get(game.id);
              return (
                <GameCard
                  key={game.id}
                  game={game}
                  onClick={() => openGame(game)}
                  userGameData={data}
                />
              );
            })}
          </div>
        )}
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

            {modalLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            ) : showDeleteConfirm ? (
              <div className="p-8">
                <div className="text-center">
                  <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-white mb-2">Удалить игру?</h2>
                  <p className="text-neutral-400 mb-6">
                    Ты уверен, что хочешь удалить <span className="text-white font-medium">{selectedGame.title}</span> из своего списка?
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
                      <p className="text-neutral-400 leading-relaxed">{selectedGame.description}</p>
                    </div>

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
                  </div>
                </div>

                {/* Статусы */}
                <div className="bg-neutral-800 rounded-xl p-5 mb-6">
                  <h2 className="font-semibold text-white mb-3">Статус</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <button
                      onClick={() => setModalStatus('want')}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
                        modalStatus === 'want'
                          ? 'bg-rose-500 text-white'
                          : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      <Heart className="w-4 h-4" /> Хочу пройти
                    </button>
                    <button
                      onClick={() => setModalStatus('playing')}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
                        modalStatus === 'playing'
                          ? 'bg-blue-500 text-white'
                          : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      <Gamepad className="w-4 h-4" /> В процессе
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
                  </div>
                </div>

                {/* Оценка и часы */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-neutral-800 rounded-xl p-5">
                    <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-indigo-500" /> Твоя оценка
                    </h3>
                    <div className="flex gap-2 mb-3">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          onClick={() => setModalRating(num)}
                          className={`w-10 h-10 rounded-lg font-medium transition ${
                            modalRating >= num
                              ? 'bg-yellow-400 text-white'
                              : 'bg-neutral-900 border border-neutral-700 text-neutral-400 hover:bg-neutral-700'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                    {modalRating > 0 && (
                      <div className="text-sm text-neutral-400">Твоя оценка: {modalRating}/5</div>
                    )}
                  </div>

                  <div className="bg-neutral-800 rounded-xl p-5">
                    <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-500" /> Часов наиграно
                    </h3>
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="number"
                        value={modalHours === 0 ? '' : modalHours}
                        onChange={(e) => {
                          const v = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                          setModalHours(v);
                        }}
                        className="w-20 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="0"
                      />
                      <span className="text-sm text-neutral-400">часов</span>
                    </div>
                    {modalHours > 0 && (
                      <div className="text-sm text-neutral-400">Ты наиграл: {modalHours}ч</div>
                    )}
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
                      <span className="text-xs text-neutral-500">{modalReview.length} символов</span>
                    </div>
                  )}
                </div>

                {/* Кнопки */}
                <div className="flex gap-3 pt-4 border-t border-neutral-800">
                  <button
                    onClick={async () => {
                      await saveModalData();
                      closeGame();
                    }}
                    className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-medium py-3 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    Сохранить
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-6 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-medium py-3 rounded-lg transition flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Удалить
                  </button>
                  <button
                    onClick={closeGame}
                    className="px-6 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium py-3 rounded-lg transition"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}