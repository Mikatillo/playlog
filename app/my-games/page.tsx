'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Gamepad, Check, Trophy, Star, Clock, Award, Flame, Zap, Crown, Loader2, Lock } from 'lucide-react';
import { Game, GameData, calculateLevel } from '@/types/game';
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
  const router = useRouter();
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

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setAuthUser(null);
        setLoading(false);
        return;
      }

      setAuthUser(user);

      // Загружаем профиль из Supabase
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

      // Загружаем игры из Supabase
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
    const avgRating = userGames.size > 0 
      ? (Array.from(userGames.values()).reduce((sum, data) => sum + (data.rating || 0), 0) / userGames.size).toFixed(1)
      : '0';

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
    { id: 'first_game', title: 'ПЕРВАЯ КРОВЬ', description: 'Добавь первую игру', icon: Heart, unlocked: stats.total >= 1, color: '#ff004d' },
    { id: 'collector', title: 'КОЛЛЕКЦИОНЕР', description: 'Добавь 10 игр', icon: Crown, unlocked: stats.total >= 10, color: '#ffec27' },
    { id: 'finisher', title: 'ФИНИШЁР', description: 'Пройди 5 игр', icon: Check, unlocked: stats.completed >= 5, color: '#00e436' },
    { id: 'hardcore', title: 'ХАРДКОРЩИК', description: 'Наиграй 100 часов', icon: Flame, unlocked: stats.totalHours >= 100, color: '#ff004d' },
    { id: 'critic', title: 'КРИТИК', description: 'Оцени 5 игр', icon: Star, unlocked: Array.from(userGames.values()).filter(d => d.rating > 0).length >= 5, color: '#29adff' },
    { id: 'marathon', title: 'МАРАФОНЕЦ', description: 'Наиграй 500 часов', icon: Zap, unlocked: stats.totalHours >= 500, color: '#b142f5' },
  ];

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  const tabs: { id: TabType; label: string; icon: any; count: number }[] = [
    { id: 'all', label: 'ВСЕ', icon: Trophy, count: stats.total },
    { id: 'want', label: 'ХОЧУ ПРОЙТИ', icon: Heart, count: stats.want },
    { id: 'playing', label: 'В ПРОЦЕССЕ', icon: Gamepad, count: stats.playing },
    { id: 'completed', label: 'ПРОШЁЛ', icon: Check, count: stats.completed },
  ];

  // Если не авторизован - показываем заглушку
  if (!authUser && !loading) {
    return (
      <div className="min-h-screen bg-[#0f0f1e] text-[#fcfcfc]">
        <div className="retro-grid"></div>
        <Header profile={profile} levelInfo={levelInfo} />
        <div className="header-line"></div>
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <Lock className="w-16 h-16 text-[#747474] mx-auto mb-4" />
          <h1 className="font-pixel text-2xl text-[#ffec27] mb-4">ДОСТУП ЗАКРЫТ</h1>
          <p className="text-lg text-[#747474] mb-6">Войди в аккаунт, чтобы видеть свои игры</p>
          <a href="/auth" className="inline-block bg-[#00e436] text-[#0f0f1e] font-pixel text-xs px-6 py-3 hover:bg-[#00ff40]">
            ВОЙТИ
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f1e] text-[#fcfcfc]">
      <div className="retro-grid"></div>

      <Header profile={profile} levelInfo={levelInfo} />

      <div className="header-line"></div>

      <div className="max-w-7xl mx-auto px-4 py-6 relative z-10">
        <div className="mb-6">
          <h1 className="font-pixel text-2xl text-[#ffec27] mb-2 text-glow">МОИ ИГРЫ</h1>
          <p className="text-lg text-[#747474]">Твоя личная коллекция и достижения</p>
        </div>

        <div className="bg-[#1a1a2e] border-2 border-[#29adff] p-3 mb-6">
          <input
            type="text"
            placeholder="ПОИСК В МОИХ ИГРАХ..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full bg-[#0f0f1e] border-2 border-[#747474] px-4 py-2 font-pixel text-xs text-[#fcfcfc] focus:outline-none focus:border-[#29adff]"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <div className="bg-[#1a1a2e] border-2 border-[#ffec27] p-3 text-center">
            <Trophy className="w-5 h-5 text-[#ffec27] mx-auto mb-1" />
            <div className="font-pixel text-xl text-[#ffec27]">{stats.total}</div>
            <div className="font-pixel text-[7px] text-[#747474]">ВСЕГО</div>
          </div>
          <div className="bg-[#1a1a2e] border-2 border-[#00e436] p-3 text-center">
            <Check className="w-5 h-5 text-[#00e436] mx-auto mb-1" />
            <div className="font-pixel text-xl text-[#00e436]">{stats.completed}</div>
            <div className="font-pixel text-[7px] text-[#747474]">ПРОЙДЕНО</div>
          </div>
          <div className="bg-[#1a1a2e] border-2 border-[#29adff] p-3 text-center">
            <Gamepad className="w-5 h-5 text-[#29adff] mx-auto mb-1" />
            <div className="font-pixel text-xl text-[#29adff]">{stats.playing}</div>
            <div className="font-pixel text-[7px] text-[#747474]">В ПРОЦЕССЕ</div>
          </div>
          <div className="bg-[#1a1a2e] border-2 border-[#ff004d] p-3 text-center">
            <Heart className="w-5 h-5 text-[#ff004d] mx-auto mb-1" />
            <div className="font-pixel text-xl text-[#ff004d]">{stats.want}</div>
            <div className="font-pixel text-[7px] text-[#747474]">ХОЧУ</div>
          </div>
          <div className="bg-[#1a1a2e] border-2 border-[#b142f5] p-3 text-center">
            <Clock className="w-5 h-5 text-[#b142f5] mx-auto mb-1" />
            <div className="font-pixel text-xl text-[#b142f5]">{stats.totalHours}h</div>
            <div className="font-pixel text-[7px] text-[#747474]">ВСЕГО ЧАСОВ</div>
          </div>
          <div className="bg-[#1a1a2e] border-2 border-[#ffec27] p-3 text-center">
            <Star className="w-5 h-5 text-[#ffec27] mx-auto mb-1" />
            <div className="font-pixel text-xl text-[#ffec27]">{stats.avgRating}</div>
            <div className="font-pixel text-[7px] text-[#747474]">СР. ОЦЕНКА</div>
          </div>
        </div>

        <div className="bg-[#1a1a2e] border-2 border-[#b142f5] p-4 mb-6">
          <h2 className="font-pixel text-xs text-[#b142f5] mb-3 flex items-center gap-2">
            <Award className="w-4 h-4" /> ДОСТИЖЕНИЯ ({unlockedCount}/{achievements.length})
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {achievements.map((achievement) => {
              const Icon = achievement.icon;
              return (
                <div
                  key={achievement.id}
                  className={`bg-[#0f0f1e] border-2 p-2 text-center transition ${
                    achievement.unlocked ? 'border-[#ffec27] opacity-100' : 'border-[#747474] opacity-40'
                  }`}
                >
                  <Icon className="w-5 h-5 mx-auto mb-1" style={{ color: achievement.unlocked ? achievement.color : '#747474' }} />
                  <div className="font-pixel text-[8px] mb-1" style={{ color: achievement.unlocked ? achievement.color : '#747474' }}>
                    {achievement.title}
                  </div>
                  <div className="font-pixel text-[7px] text-[#747474] leading-tight">
                    {achievement.description}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`font-pixel text-[10px] px-3 py-2 border-2 flex items-center gap-2 transition ${
                  activeTab === tab.id
                    ? 'bg-[#ffec27] text-[#0f0f1e] border-[#ffec27]'
                    : 'bg-[#1a1a2e] text-[#fcfcfc] border-[#747474] hover:border-[#ffec27]'
                }`}
              >
                <Icon className="w-3 h-3" />
                {tab.label} ({tab.count})
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#b142f5] animate-spin" />
            <span className="font-pixel text-xs ml-3 text-[#747474]">ЗАГРУЗКА...</span>
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="text-center py-20 bg-[#1a1a2e] border-2 border-[#747474]">
            <p className="font-pixel text-sm text-[#747474] mb-2">
              {activeTab === 'all' ? 'ТЫ ЕЩЁ НЕ ДОБАВИЛ НИ ОДНОЙ ИГРЫ' : 'СПИСОК ПУСТ'}
            </p>
            <p className="font-pixel text-[10px] text-[#747474]">
              Вернись на главную и добавь игры в список
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredGames.map((game) => {
              const data = userGames.get(game.id);
              return (
                <div key={game.id} className="relative">
                  <GameCard
                    game={game}
                    onClick={() => router.push(`/?game=${game.id}`)}
                  />
                  {data && (
                    <div className="absolute bottom-0 left-0 right-0 bg-[#0f0f1e]/90 border-t-2 border-[#747474] p-1">
                      <div className="flex justify-between items-center">
                        {data.rating > 0 && (
                          <span className="font-pixel text-[8px] text-[#ffec27] flex items-center gap-1">
                            <Star className="w-2 h-2 fill-[#ffec27]" /> {data.rating}
                          </span>
                        )}
                        {data.hours > 0 && (
                          <span className="font-pixel text-[8px] text-[#00e436] flex items-center gap-1 ml-auto">
                            <Clock className="w-2 h-2" /> {data.hours}h
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}