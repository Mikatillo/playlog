import type { Game } from '@/types/game';

export interface RawgGame {
  id: number;
  name: string;
  background_image: string;
  released: string;
  rating: number;
  metacritic: number;
  description: string;
  description_raw?: string;
  genres: { id: number; name: string }[];
  tags?: { id: number; name: string }[];
  platforms: { platform: { name: string } }[];
  screenshots?: { id: number; image: string }[];
  movies?: { id: number; data: { 480: string; max: string }; preview: string }[];
  playtime?: number;
}

/**
 * RAWG отдаёт обложки в полном размере (1–3 МБ). Через путь /media/resize/<ширина>/-/
 * можно получить уменьшенную копию — это сильно ускоряет загрузку списков игр.
 */
export function rawgResize(url: string | null | undefined, width = 640): string {
  if (!url) return '';
  const marker = 'https://media.rawg.io/media/';
  if (url.startsWith(marker) && !url.startsWith(marker + 'resize/')) {
    return url.replace(marker, `${marker}resize/${width}/-/`);
  }
  return url;
}

export function mapRawgGame(raw: RawgGame): Game {
  const cleanDescription =
    raw.description?.replace(/<[^>]*>/g, '').substring(0, 300) ||
    'Описание отсутствует';

  return {
    id: raw.id,
    title: raw.name,
    cover: rawgResize(raw.background_image, 640),
    year: Number(raw.released?.split('-')[0]) || 0,
    released: raw.released || undefined,
    rating: Math.round(raw.rating * 10) / 10,
    genre: raw.genres?.[0]?.name || 'Неизвестно',
    genres: raw.genres || [],
    tags: raw.tags || [],
    description: cleanDescription,
    descriptionRaw: raw.description_raw || raw.description || '',
    descriptionRu: undefined,
    platforms: raw.platforms?.map((p) => p.platform.name) || [],
    screenshots: raw.screenshots || [],
    trailer: raw.movies?.[0]?.data?.max || raw.movies?.[0]?.preview || '',
    metacritic: raw.metacritic || undefined,
    playtime: raw.playtime || undefined,
  };
}