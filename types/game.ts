export interface Game {
  id: number;
  title: string;
  cover: string;
  year: number;
  rating: number;
  genre: string;
  genres?: { id: number; name: string }[];
  tags?: { id: number; name: string; slug?: string }[];
  description: string;
  descriptionRaw?: string;
  descriptionRu?: string;
  platforms: string[];
  screenshots: { id: number; image: string }[];
  trailer?: string;
  metacritic?: number;
  steamRating?: number;
  playtime?: number; // <-- ДОБАВЛЕНО: среднее время прохождения
}

export interface GameData {
  rating: number;
  hours: number;
  review: string;
  status: 'none' | 'want' | 'playing' | 'completed' | 'dropped';
  xp: number;
}

export interface UserProfile {
  nickname: string;
  xp: number;
  totalGames: number;
  completedGames: number;
  totalHours: number;
}

export interface LevelInfo {
  level: number;
  xpInLevel: number;
  xpToNext: number;
}

export const XP_RULES = {
  ADD_GAME: 10,
  RATE: 5,
  REVIEW: 20,
  COMPLETE: 50,
  DROP: 5,
};

export function calculateLevel(xp: number): LevelInfo {
  const level = Math.floor(xp / 100) + 1;
  const xpInLevel = xp % 100;
  const xpToNext = 100;
  return { level, xpInLevel, xpToNext };
}

export interface AchievementLevel {
  level: number;
  threshold: number;
  color: string;
  glowColor: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // название иконки из lucide
  category: 'games' | 'completed' | 'hours' | 'ratings' | 'reviews' | 'wishlist';
  levels: AchievementLevel[];
}

export function getAchievementLevel(thresholds: number[], value: number): { level: number; progress: number; nextThreshold: number | null } {
  let level = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (value >= thresholds[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  const nextThreshold = level < thresholds.length ? thresholds[level] : null;
  const prevThreshold = level > 0 ? thresholds[level - 1] : 0;
  const progress = nextThreshold ? ((value - prevThreshold) / (nextThreshold - prevThreshold)) * 100 : 100;
  return { level, progress: Math.min(100, Math.max(0, progress)), nextThreshold };
}

export const ACHIEVEMENT_LEVELS: AchievementLevel[] = [
  { level: 1, threshold: 0, color: '#737373', glowColor: 'rgba(115,115,115,0.3)' },
  { level: 2, threshold: 0, color: '#a3a3a3', glowColor: 'rgba(163,163,163,0.3)' },
  { level: 3, threshold: 0, color: '#a8a29e', glowColor: 'rgba(168,162,158,0.3)' },
  { level: 4, threshold: 0, color: '#a16207', glowColor: 'rgba(161,98,7,0.3)' },
  { level: 5, threshold: 0, color: '#ca8a04', glowColor: 'rgba(202,138,4,0.3)' },
  { level: 6, threshold: 0, color: '#eab308', glowColor: 'rgba(234,179,8,0.3)' },
  { level: 7, threshold: 0, color: '#facc15', glowColor: 'rgba(250,204,21,0.4)' },
  { level: 8, threshold: 0, color: '#fbbf24', glowColor: 'rgba(251,191,36,0.5)' },
  { level: 9, threshold: 0, color: '#fcd34d', glowColor: 'rgba(252,211,77,0.6)' },
  { level: 10, threshold: 0, color: '#fde047', glowColor: 'rgba(253,224,71,0.8)' },
];