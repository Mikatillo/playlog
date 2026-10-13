import type { Game } from '@/types/game';

const CLIENT_ID = process.env.IGDB_CLIENT_ID!;
const CLIENT_SECRET = process.env.IGDB_CLIENT_SECRET!;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.warn('[IGDB] Missing IGDB_CLIENT_ID or IGDB_CLIENT_SECRET in .env.local');
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getIgdbToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60 * 60 * 1000) {
    return cachedToken.token;
  }

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IGDB auth failed: ${res.status} ${text}`);
  }

  const data = await res.json();

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

export async function igdbQuery<T = any>(endpoint: string, body: string): Promise<T> {
  const token = await getIgdbToken();

  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: 'POST',
    headers: {
      'Client-ID': CLIENT_ID,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain',
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IGDB query failed: ${res.status} ${text}`);
  }

  return res.json();
}

// === Маппинг IGDB → внутренний тип Game ===

// IGDB external_game_source: 1 = Steam
const IGDB_SOURCE_STEAM = 1;

export interface IgdbExternalGame {
  id: number;
  uid: string;
  external_game_source: number;
}

export interface IgdbGame {
  id: number;
  name: string;
  game_type?: number;
  version_parent?: number;
  cover?: { id: number; image_id: string };
  first_release_date?: number;
  rating?: number;
  rating_count?: number;
  aggregated_rating?: number;
  aggregated_rating_count?: number;
  total_rating?: number;
  total_rating_count?: number;
  genres?: { id: number; name: string }[];
  platforms?: { id: number; name: string }[];
  summary?: string;
  storyline?: string;
  screenshots?: { id: number; image_id: string }[];
  artworks?: { id: number; image_id: string }[];
  videos?: { id: number; video_id: string }[];
  game_modes?: { id: number; name: string }[];
  external_games?: IgdbExternalGame[];
}

export function igdbImageUrl(imageId: string, size = 't_cover_big'): string {
  return `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`;
}

// Steam-обложка 460x215 — горизонтальная, красивая
export function steamHeaderUrl(appid: string | number): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

// Ищем Steam appid в external_games (external_game_source = 1)
function findSteamAppId(raw: IgdbGame): string | null {
  if (!raw.external_games) return null;
  const steam = raw.external_games.find((e) => e.external_game_source === IGDB_SOURCE_STEAM);
  return steam?.uid || null;
}

export function mapIgdbGame(raw: IgdbGame): Game {
  const year = raw.first_release_date
    ? new Date(raw.first_release_date * 1000).getFullYear()
    : 0;

  const released = raw.first_release_date
    ? new Date(raw.first_release_date * 1000).toISOString().split('T')[0]
    : undefined;

  // Приоритет обложек:
  // 1. Steam header (460×215, идеально горизонтальная)
  // 2. IGDB screenshot (игровой кадр 16:9)
  // 3. IGDB artwork (концепт-арт)
  // 4. IGDB cover (вертикальный постер)
  let cover = '';

  const steamAppId = findSteamAppId(raw);
  if (steamAppId) {
    cover = steamHeaderUrl(steamAppId);
  } else {
    const horizontalId =
      raw.screenshots?.[0]?.image_id || raw.artworks?.[0]?.image_id;

    if (horizontalId) {
      cover = igdbImageUrl(horizontalId, 't_1080p');
    } else if (raw.cover?.image_id) {
      cover = igdbImageUrl(raw.cover.image_id, 't_cover_big');
    }
  }

  const rating = raw.rating
    ? Math.round(raw.rating) / 10
    : raw.aggregated_rating
      ? Math.round(raw.aggregated_rating) / 10
      : 0;

  return {
    id: raw.id,
    title: raw.name,
    cover,
    year,
    released,
    rating,
    genre: raw.genres?.[0]?.name || 'Неизвестно',
    genres: raw.genres || [],
    tags: [],
    description:
      (raw.summary || raw.storyline || '').substring(0, 300) ||
      'Описание отсутствует',
    descriptionRaw: raw.summary || raw.storyline || '',
    descriptionRu: undefined,
    platforms: raw.platforms?.map((p) => p.name) || [],
    screenshots: (raw.screenshots || []).map((s) => ({
      id: s.id,
      image: igdbImageUrl(s.image_id, 't_screenshot_big'),
    })),
    trailer: raw.videos?.[0]?.video_id
      ? `https://www.youtube.com/watch?v=${raw.videos[0].video_id}`
      : '',
    metacritic: raw.aggregated_rating
      ? Math.round(raw.aggregated_rating)
      : undefined,
    playtime: undefined,
  };
}
// ============================================================
// Steam API поиск по названию (для игр без external_games)
// ============================================================

// Нормализация названия: убираем ™®, лишние пробелы, "The" в начале
function normalizeTitle(title: string): string {
  return title
    .replace(/™|®/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Ищем appid через публичный Steam Search API
export async function findSteamAppIdByTitle(title: string): Promise<string | null> {
  try {
    const clean = normalizeTitle(title);
    if (!clean) return null;

    const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(clean)}&l=en&cc=US`;
    const res = await fetch(url, {
      next: { revalidate: 86400 }, // кэш на сутки
    });
    if (!res.ok) return null;

    const data = await res.json();
    const items = data?.items || [];
    if (!items.length) return null;

    // Берём первый результат (Steam сам сортирует по релевантности)
    const first = items[0];
    if (first?.id) return String(first.id);

    return null;
  } catch {
    return null;
  }
}