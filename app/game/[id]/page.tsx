'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Star, Clock, Monitor, Trophy, MessageSquare, Heart, Gamepad, Check } from 'lucide-react';
import { useState, useEffect, Suspense } from 'react';

interface Game {
  id: number;
  title: string;
  cover: string;
  rating: number;
  hours: number;
  platforms: string[];
  genre: string;
  year: number;
  description: string;
}

const allGames: Game[] = [
  { id: 1, title: "Baldur's Gate 3", cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co5s5v.jpg", rating: 9.6, hours: 120, platforms: ["PC", "PS5"], genre: "RPG", year: 2023, description: "Эпическая RPG от Larian Studios. Соберите отряд, исследуйте Забытые Королевства и раскройте тайну иллитидов." },
  { id: 2, title: "Elden Ring", cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co4mfb.jpg", rating: 9.4, hours: 95, platforms: ["PC", "PS5", "Xbox"], genre: "RPG", year: 2022, description: "Souls-like от FromSoftware и Джорджа Мартина. Исследуйте Междуземье и станьте Повелителем Элдена." },
  { id: 3, title: "Cyberpunk 2077", cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co2l6h.jpg", rating: 8.8, hours: 80, platforms: ["PC", "PS5", "Xbox"], genre: "RPG", year: 2020, description: "Футуристический Найт-Сити. Станьте киберпанком Ви и раскройте тайну бессмертия." },
  { id: 5, title: "Black Myth: Wukong", cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co5m2v.jpg", rating: 8.5, hours: 60, platforms: ["PC", "PS5"], genre: "RPG", year: 2024, description: "Китайская мифология в действии. Играйте за Судьбу и сражайтесь с демонами." },
  { id: 6, title: "Metaphor: ReFantazio", cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co7r3k.jpg", rating: 9.2, hours: 100, platforms: ["PC", "PS5", "Xbox"], genre: "RPG", year: 2024, description: "Фэнтези от создателей Persona. Спасите королевство и станьте королём." },
  { id: 7, title: "The Witcher 3", cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg", rating: 9.5, hours: 150, platforms: ["PC", "PS5", "Xbox", "Switch"], genre: "RPG", year: 2015, description: "Приключения Геральта из Ривии. Найдите Дитя Предназначения в открытом мире." },
  { id: 8, title: "Persona 5 Royal", cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1y8o.jpg", rating: 9.3, hours: 110, platforms: ["PC", "PS5", "Xbox", "Switch"], genre: "RPG", year: 2019, description: "Стильная JRPG о призрачных ворах. Украдите сердца коррупционеров." },
  { id: 4, title: "Hades II", cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co5p3k.jpg", rating: 9.0, hours: 45, platforms: ["PC"], genre: "Action", year: 2024, description: "Рогалик от Supergiant. Играйте за Мелиною и сражайтесь с Хроносом." },
  { id: 9, title: "God of War Ragnarök", cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co4q0g.jpg", rating: 9.1, hours: 50, platforms: ["PC", "PS5"], genre: "Action", year: 2022, description: "Кратос и Атрей против скандинавских богов. Рагнарёк неизбежен." },
  { id: 10, title: "Sekiro: Shadows Die Twice", cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1y3r.jpg", rating: 9.0, hours: 40, platforms: ["PC", "PS5", "Xbox"], genre: "Action", year: 2019, description: "Ниндзя-экшен от FromSoftware. Освободите своего господина." },
  { id: 11, title: "DOOM Eternal", cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co20ay.jpg", rating: 8.7, hours: 30, platforms: ["PC", "PS5", "Xbox", "Switch"], genre: "Action", year: 2020, description: "Быстрый и жестокий шутер. Уничтожайте демонов под тяжелый метал." },
  { id: 12, title: "Hollow Knight", cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1s6z.jpg", rating: 9.2, hours: 35, platforms: ["PC", "PS5", "Xbox", "Switch"], genre: "Indie", year: 2017, description: "Атмосферный метроидвания в подземном королевстве насекомых." },
  { id: 13, title: "Celeste", cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1n4s.jpg", rating: 9.0, hours: 20, platforms: ["PC", "PS5", "Xbox", "Switch"], genre: "Indie", year: 2018, description: "Платформер о преодолении тревоги и восхождении на гору Селест." },
  { id: 14, title: "Stardew Valley", cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1l2h.jpg", rating: 9.1, hours: 200, platforms: ["PC", "PS5", "Xbox", "Switch"], genre: "Indie", year: 2016, description: "Фермерский симулятор. Выращивайте урожай, рыбачьте и дружите с жителями." },
  { id: 15, title: "Hades", cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co29l0.jpg", rating: 9.3, hours: 60, platforms: ["PC", "PS5", "Xbox", "Switch"], genre: "Indie", year: 2020, description: "Рогалик о побеге из ада. Играйте за Загрея, сына Аида." },
  { id: 16, title: "Civilization VI", cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1p4r.jpg", rating: 8.5, hours: 300, platforms: ["PC", "PS5", "Xbox", "Switch"], genre: "Strategy", year: 2016, description: "Построй империю, которая выдержит испытание временем." },
  { id: 17, title: "XCOM 2", cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1n8s.jpg", rating: 8.8, hours: 80, platforms: ["PC", "PS5", "Xbox"], genre: "Strategy", year: 2016, description: "Тактика против пришельцев. Освободите Землю от инопланетного владычества." },
  { id: 18, title: "Crusader Kings III", cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co29m1.jpg", rating: 8.6, hours: 250, platforms: ["PC", "PS5", "Xbox"], genre: "Strategy", year: 2020, description: "Средневековая династия. Управляйте своим родом сквозь века." },
  { id: 41, title: "Resident Evil 4 Remake", cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co5p2k.jpg", rating: 9.1, hours: 25, platforms: ["PC", "PS5", "Xbox"], genre: "Horror", year: 2023, description: "Переосмысление классики хоррора. Спасите дочь президента." },
  { id: 42, title: "Silent Hill 2 Remake", cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co7p2k.jpg", rating: 8.8, hours: 20, platforms: ["PC", "PS5"], genre: "Horror", year: 2024, description: "Психологический хоррор. Джеймс возвращается в туманный город." },
  { id: 45, title: "Forza Horizon 5", cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co3p4k.jpg", rating: 9.0, hours: 60, platforms: ["PC", "Xbox"], genre: "Racing", year: 2021, description: "Аркадные гонки в Мексике. Исследуйте открытый мир за рулём." },
  { id: 50, title: "Rocket League", cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1p5k.jpg", rating: 8.9, hours: 200, platforms: ["PC", "PS5", "Xbox", "Switch"], genre: "Sports", year: 2015, description: "Футбол на машинках. Быстро, весело и соревновательно." },
];

interface GameData {
  rating: number;
  hours: number;
  review: string;
  status: 'none' | 'want' | 'playing' | 'completed';
}

function GamePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameId = parseInt(searchParams.get('id') || '1');
  const game = allGames.find(g => g.id === gameId);

  const [userRating, setUserRating] = useState(0);
  const [userHours, setUserHours] = useState(0);
  const [review, setReview] = useState('');
  const [gameStatus, setGameStatus] = useState<'none' | 'want' | 'playing' | 'completed'>('none');
  const [saved, setSaved] = useState(false);

  // Загружаем сохранённые данные при открытии
  useEffect(() => {
    if (!game) return;
    const savedData = localStorage.getItem(`game_${game.id}`);
    if (savedData) {
      const data: GameData = JSON.parse(savedData);
      setUserRating(data.rating || 0);
      setUserHours(data.hours || 0);
      setReview(data.review || '');
      setGameStatus(data.status || 'none');
    }
  }, [gameId]);

  // Сохраняем данные
  const saveData = (newRating: number, newHours: number, newReview: string, newStatus: 'none' | 'want' | 'playing' | 'completed') => {
    if (!game) return;
    const data: GameData = {
      rating: newRating,
      hours: newHours,
      review: newReview,
      status: newStatus,
    };
    localStorage.setItem(`game_${game.id}`, JSON.stringify(data));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!game) {
    return (
      <div className="min-h-screen bg-[#0f0f1e] text-[#fcfcfc] flex items-center justify-center">
        <div className="text-center">
          <p className="font-pixel text-xl text-[#ff004d] mb-4">ИГРА НЕ НАЙДЕНА</p>
          <button
            onClick={() => router.push('/')}
            className="font-pixel text-xs bg-[#00e436] text-[#0f0f1e] px-4 py-3"
          >
            ВЕРНУТЬСЯ НА ГЛАВНУЮ
          </button>
        </div>
      </div>
    );
  }

  const handleAddToList = (status: 'want' | 'playing' | 'completed') => {
    setGameStatus(status);
    saveData(userRating, userHours, review, status);
  };

  const handleRatingChange = (num: number) => {
    setUserRating(num);
    saveData(num, userHours, review, gameStatus);
  };

  const handleHoursChange = (val: number) => {
    setUserHours(val);
    saveData(userRating, val, review, gameStatus);
  };

  const handleReviewChange = (val: string) => {
    setReview(val);
    saveData(userRating, userHours, val, gameStatus);
  };

  return (
    <div className="min-h-screen bg-[#0f0f1e] text-[#fcfcfc]">
      <div className="retro-grid"></div>

      <header className="sticky top-0 z-40 bg-[#1a1a2e] border-b-2 border-[#b142f5]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 font-pixel text-xs text-[#29adff] hover:text-[#ffec27] transition"
          >
            <ArrowLeft className="w-4 h-4" /> НАЗАД
          </button>
          <div className="font-pixel text-sm">
            <span className="text-[#ff004d]">PLAY</span>
            <span className="text-[#00e436]">LOG</span>
          </div>
        </div>
      </header>

      <div className="header-line"></div>

      <div className="max-w-7xl mx-auto px-4 py-8 relative z-10">
        {saved && (
          <div className="fixed top-20 right-4 bg-[#00e436] text-[#0f0f1e] px-4 py-2 font-pixel text-xs z-50 border-2 border-[#00e436]">
            СОХРАНЕНО!
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1">
            <div className="bg-[#1a1a2e] border-4 border-[#ff004d] p-2">
              <img
                src={game.cover}
                alt={game.title}
                className="w-full aspect-[2/3] object-cover"
              />
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div>
              <h1 className="font-pixel text-2xl md:text-3xl text-[#ffec27] mb-2 text-glow">
                {game.title.toUpperCase()}
              </h1>
              <div className="flex flex-wrap gap-3 mb-4">
                <span className="font-pixel text-[10px] bg-[#b142f5] px-3 py-1">{game.genre}</span>
                <span className="font-pixel text-[10px] bg-[#29adff] px-3 py-1">{game.year}</span>
                <span className="font-pixel text-[10px] bg-[#00e436] text-[#0f0f1e] px-3 py-1 flex items-center gap-1">
                  <Star className="w-3 h-3 fill-[#0f0f1e]" /> {game.rating}
                </span>
              </div>
              <p className="text-xl text-[#fcfcfc] leading-relaxed">
                {game.description}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[#1a1a2e] border-2 border-[#ffec27] p-3 text-center">
                <Star className="w-6 h-6 text-[#ffec27] mx-auto mb-2" />
                <div className="font-pixel text-xl text-[#ffec27]">{game.rating}</div>
                <div className="font-pixel text-[8px] text-[#747474] mt-1">РЕЙТИНГ</div>
              </div>
              <div className="bg-[#1a1a2e] border-2 border-[#00e436] p-3 text-center">
                <Clock className="w-6 h-6 text-[#00e436] mx-auto mb-2" />
                <div className="font-pixel text-xl text-[#00e436]">{game.hours}h</div>
                <div className="font-pixel text-[8px] text-[#747474] mt-1">ЧАСОВ</div>
              </div>
              <div className="bg-[#1a1a2e] border-2 border-[#29adff] p-3 text-center">
                <Monitor className="w-6 h-6 text-[#29adff] mx-auto mb-2" />
                <div className="font-pixel text-sm text-[#29adff]">{game.platforms.length}</div>
                <div className="font-pixel text-[8px] text-[#747474] mt-1">ПЛАТФОРМ</div>
              </div>
              <div className="bg-[#1a1a2e] border-2 border-[#b142f5] p-3 text-center">
                <Trophy className="w-6 h-6 text-[#b142f5] mx-auto mb-2" />
                <div className="font-pixel text-xl text-[#b142f5]">{game.year}</div>
                <div className="font-pixel text-[8px] text-[#747474] mt-1">ГОД</div>
              </div>
            </div>

            <div>
              <h3 className="font-pixel text-xs text-[#747474] mb-2">ПЛАТФОРМЫ:</h3>
              <div className="flex gap-2">
                {game.platforms.map((platform) => (
                  <div key={platform} className="bg-[#1a1a2e] border-2 border-[#747474] px-3 py-2 font-pixel text-[10px]">
                    {platform}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#1a1a2e] border-4 border-[#00e436] p-6 mb-8">
          <h2 className="font-pixel text-sm text-[#00e436] mb-4 flex items-center gap-2">
            ДОБАВИТЬ В СПИСОК
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={() => handleAddToList('want')}
              className={`font-pixel text-xs px-4 py-3 border-2 transition ${
                gameStatus === 'want'
                  ? 'bg-[#ffec27] text-[#0f0f1e] border-[#ffec27]'
                  : 'bg-[#0f0f1e] text-[#fcfcfc] border-[#747474] hover:border-[#ffec27]'
              }`}
            >
              <Heart className="w-4 h-4 inline mr-2" /> ХОЧУ ПРОЙТИ
            </button>
            <button
              onClick={() => handleAddToList('playing')}
              className={`font-pixel text-xs px-4 py-3 border-2 transition ${
                gameStatus === 'playing'
                  ? 'bg-[#29adff] text-[#0f0f1e] border-[#29adff]'
                  : 'bg-[#0f0f1e] text-[#fcfcfc] border-[#747474] hover:border-[#29adff]'
              }`}
            >
              <Gamepad className="w-4 h-4 inline mr-2" /> В ПРОЦЕССЕ
            </button>
            <button
              onClick={() => handleAddToList('completed')}
              className={`font-pixel text-xs px-4 py-3 border-2 transition ${
                gameStatus === 'completed'
                  ? 'bg-[#00e436] text-[#0f0f1e] border-[#00e436]'
                  : 'bg-[#0f0f1e] text-[#fcfcfc] border-[#747474] hover:border-[#00e436]'
              }`}
            >
              <Check className="w-4 h-4 inline mr-2" /> ПРОШЁЛ
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#1a1a2e] border-2 border-[#ffec27] p-6">
            <h3 className="font-pixel text-xs text-[#ffec27] mb-4 flex items-center gap-2">
              <Trophy className="w-4 h-4" /> ТВОЯ ОЦЕНКА
            </h3>
            <div className="flex gap-2 mb-4 flex-wrap">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                <button
                  key={num}
                  onClick={() => handleRatingChange(num)}
                  className={`w-8 h-8 font-pixel text-xs border-2 transition ${
                    userRating >= num
                      ? 'bg-[#ffec27] text-[#0f0f1e] border-[#ffec27]'
                      : 'bg-[#0f0f1e] text-[#747474] border-[#747474] hover:border-[#ffec27]'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
            {userRating > 0 && (
              <div className="font-pixel text-sm text-[#ffec27]">
                Твоя оценка: {userRating}/10
              </div>
            )}
          </div>

          <div className="bg-[#1a1a2e] border-2 border-[#00e436] p-6">
            <h3 className="font-pixel text-xs text-[#00e436] mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" /> ЧАСОВ НАИГРАНО
            </h3>
            <div className="flex items-center gap-3 mb-4">
              <input
                type="number"
                value={userHours}
                onChange={(e) => handleHoursChange(parseInt(e.target.value) || 0)}
                className="w-24 bg-[#0f0f1e] border-2 border-[#747474] px-3 py-2 font-pixel text-sm text-[#fcfcfc] focus:outline-none focus:border-[#00e436]"
                placeholder="0"
              />
              <span className="font-pixel text-sm text-[#747474]">часов</span>
            </div>
            {userHours > 0 && (
              <div className="font-pixel text-sm text-[#00e436]">
                Ты наиграл: {userHours}ч
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#1a1a2e] border-2 border-[#b142f5] p-6 mt-6">
          <h3 className="font-pixel text-xs text-[#b142f5] mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> ТВОЯ РЕЦЕНЗИЯ
          </h3>
          <textarea
            value={review}
            onChange={(e) => handleReviewChange(e.target.value)}
            placeholder="Напиши своё мнение об игре..."
            className="w-full bg-[#0f0f1e] border-2 border-[#747474] p-3 font-pixel text-xs text-[#fcfcfc] focus:outline-none focus:border-[#b142f5] min-h-[120px] resize-y"
          />
          {review.length > 0 && (
            <div className="mt-3 text-right">
              <span className="font-pixel text-[10px] text-[#747474]">
                {review.length} символов
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0f0f1e] flex items-center justify-center">
        <p className="font-pixel text-[#ffec27]">ЗАГРУЗКА...</p>
      </div>
    }>
      <GamePageContent />
    </Suspense>
  );
}