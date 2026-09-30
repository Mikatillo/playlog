import { Game } from '@/types/game';

export interface RawgGame {
  id: number;
  name: string;
  background_image: string;
  rating: number;
  released: string;
  platforms: { platform: { name: string; id: number } }[];
  genres: { name: string; slug: string; id: number }[];
  metacritic: number;
  description?: string;
  short_screenshots?: { id: number; image: string }[];
}

export function mapRawgGame(rawg: RawgGame): Game {
  const platformMap: Record<number, string> = {
    4: 'PC',
    18: 'PS4',
    187: 'PS5',
    1: 'Xbox One',
    186: 'Xbox Series S/X',
    7: 'Nintendo Switch',
    14: 'Nintendo DS',
    167: 'Nintendo 3DS',
  };

  const genreMap: Record<string, string> = {
    'action': 'Action',
    'adventure': 'Adventure',
    'rpg': 'RPG',
    'strategy': 'Strategy',
    'shooter': 'Shooter',
    'casual': 'Casual',
    'simulation': 'Simulation',
    'puzzle': 'Puzzle',
    'arcade': 'Arcade',
    'platformer': 'Platformer',
    'racing': 'Racing',
    'sports': 'Sports',
    'fighting': 'Fighting',
    'indie': 'Indie',
    'mmorpg': 'MMORPG',
  };

  const platforms = rawg.platforms
    .map(p => platformMap[p.platform.id] || p.platform.name)
    .filter((v, i, a) => a.indexOf(v) === i);

  const genre = rawg.genres.length > 0 
    ? (genreMap[rawg.genres[0].slug] || rawg.genres[0].name)
    : 'Other';

  const year = rawg.released ? new Date(rawg.released).getFullYear() : 2024;

  return {
    id: rawg.id,
    title: rawg.name,
    cover: rawg.background_image || 'https://via.placeholder.com/300x400/1a1a2e/747474?text=NO+IMAGE',
    rating: Math.round((rawg.rating || 0) * 10) / 10,
    hours: 0,
    platforms: platforms.length > 0 ? platforms : ['PC'],
    genre,
    year,
    description: `${rawg.name} — ${genre} игра ${year} года.`,
  };
}