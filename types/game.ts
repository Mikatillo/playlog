export interface Game {
  id: number;
  title: string;
  cover: string;
  rating: number;
  hours: number;
  platforms: string[];
  genre: string;
  year: number;
  description: string;
  trailerUrl?: string;
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

export function calculateLevel(totalXp: number): LevelInfo {
  let level = 1;
  let xpRemaining = totalXp;
  let xpForNext = 100;
  
  while (xpRemaining >= xpForNext) {
    xpRemaining -= xpForNext;
    level++;
    xpForNext = Math.floor(xpForNext * 1.5);
  }
  
  return { 
    level, 
    xpInLevel: xpRemaining, 
    xpToNext: xpForNext 
  };
}