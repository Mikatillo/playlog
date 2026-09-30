export interface Game {
  id: number;
  title: string;
  cover: string;
  year: number;
  rating: number;
  genre: string;
  description: string;
  descriptionRaw?: string;
  descriptionRu?: string;
  platforms: string[];
  screenshots: { id: number; image: string }[];
  trailer?: string;
}

export interface GameData {
  rating: number;
  hours: number;
  review: string;
  status: 'none' | 'want' | 'playing' | 'completed';
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
};

export function calculateLevel(xp: number): LevelInfo {
  const level = Math.floor(xp / 100) + 1;
  const xpInLevel = xp % 100;
  const xpToNext = 100;
  return { level, xpInLevel, xpToNext };
}