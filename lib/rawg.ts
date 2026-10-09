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

// Убираем HTML-теги и лишние пробелы
function stripHtml(html: string | undefined | null): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')   // вырезаем все теги <...>
    .replace(/&nbsp;/g, ' ')     // распространённые HTML-сущности
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')        // схлопываем пробелы/переносы
    .trim();
}

export function mapRawgGame(raw: RawgGame): Game {
  const cleanDescription =
    stripHtml(raw.description).substring(0, 300) || 'Описание отсутствует';

  const cleanDescriptionRaw = stripHtml(raw.description_raw || raw.description);

  return {
    id: raw.id,
    title: raw.name,
    cover: raw.background_image,
    year: Number(raw.released?.split('-')[0]) || 0,
    released: raw.released || undefined,
    rating: Math.round(raw.rating * 10) / 10,
    genre: raw.genres?.[0]?.name || 'Неизвестно',
    genres: raw.genres || [],
    tags: raw.tags || [],
    description: cleanDescription,
    descriptionRaw: cleanDescriptionRaw,
    descriptionRu: undefined,
    platforms: raw.platforms?.map((p) => p?.platform?.name).filter(Boolean) as string[] || [],
    screenshots: raw.screenshots || [],
    trailer: raw.movies?.[0]?.data?.max || raw.movies?.[0]?.preview || '',
    metacritic: raw.metacritic || undefined,
    playtime: raw.playtime || undefined,
  };
}