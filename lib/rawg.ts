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

/**
 * RAWG отдаёт описание в виде HTML (<p>, <br>, &nbsp; ...).
 * Превращаем в чистый текст: абзацы — пустая строка, <br> — перенос.
 */
export function cleanDescription(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6]|ul|ol)\s*>/gi, '\n\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function mapRawgGame(raw: RawgGame): Game {
  const shortDescription =
    cleanDescription(raw.description).replace(/\s+/g, ' ').substring(0, 300) ||
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
    description: shortDescription,
    descriptionRaw: cleanDescription(raw.description_raw || raw.description),
    descriptionRu: undefined,
    platforms: raw.platforms?.map((p) => p.platform.name) || [],
    screenshots: raw.screenshots || [],
    trailer: raw.movies?.[0]?.data?.max || raw.movies?.[0]?.preview || '',
    metacritic: raw.metacritic || undefined,
    playtime: raw.playtime || undefined,
  };
}