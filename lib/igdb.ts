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

// IGDB разрешает 4 запроса в секунду — ставим запросы в очередь с паузой между стартами
let lastStart = 0;
let queue: Promise<void> = Promise.resolve();

function waitTurn(): Promise<void> {
  const turn = queue.then(async () => {
    const wait = Math.max(0, lastStart + 280 - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastStart = Date.now();
  });
  queue = turn.catch(() => {});
  return turn;
}

// Небольшой кэш ответов в памяти сервера (одинаковый запрос не уходит в IGDB повторно)
const responseCache = new Map<string, { at: number; data: any }>();
const CACHE_LIMIT = 300;

async function igdbFetch(endpoint: string, body: string): Promise<any> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    await waitTurn();
    const token = await getIgdbToken();

    const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
      method: 'POST',
      headers: {
        'Client-ID': CLIENT_ID,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body,
      cache: 'no-store',
    });

    if (res.ok) return res.json();

    const text = await res.text();
    lastError = new Error(`IGDB query failed: ${res.status} ${text}`);

    if (res.status === 401) {
      cachedToken = null; // токен протух — получим новый и повторим
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      continue;
    }
    break; // 400 и прочее — повторять бессмысленно
  }

  throw lastError || new Error('IGDB query failed');
}

/**
 * Запрос к IGDB. ttlMs — сколько держать ответ в памяти сервера (0 = не кэшировать).
 */
export async function igdbQuery<T = any>(endpoint: string, body: string, ttlMs = 0): Promise<T> {
  const key = `${endpoint}::${body}`;
  if (ttlMs > 0) {
    const hit = responseCache.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
  }

  const data = await igdbFetch(endpoint, body);

  if (ttlMs > 0) {
    if (responseCache.size >= CACHE_LIMIT) {
      const first = responseCache.keys().next().value;
      if (first) responseCache.delete(first);
    }
    responseCache.set(key, { at: Date.now(), data });
  }
  return data as T;
}

/**
 * Несколько запросов одним обращением (/multiquery, до 10 штук) — экономит лимит 4 req/sec.
 * Возвращает карту: имя запроса → результат.
 */
export async function igdbMulti<T = any>(
  queries: { name: string; endpoint: string; body: string }[],
  ttlMs = 0,
): Promise<Record<string, T[]>> {
  const out: Record<string, T[]> = {};
  for (let i = 0; i < queries.length; i += 10) {
    const chunk = queries.slice(i, i + 10);
    const body = chunk
      .map((q) => `query ${q.endpoint} "${q.name}" {\n${q.body}\n};`)
      .join('\n');
    const data = await igdbQuery<{ name: string; result: T[] }[]>('multiquery', body, ttlMs);
    (data || []).forEach((d) => {
      out[d.name] = d.result || [];
    });
  }
  return out;
}

/** Экранирует строку для запроса IGDB (кавычки и слэши ломают Apicalypse). */
export function igdbEscape(s: string): string {
  return s.replace(/\\/g, ' ').replace(/"/g, ' ').replace(/\s+/g, ' ').trim();
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
  themes?: { id: number; name: string }[];
  hypes?: number;
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
  let coverAlt: string | undefined;

  // Картинка IGDB — она же запасная, если Steam header окажется 404 (у новых игр бывает)
  const horizontalId = raw.screenshots?.[0]?.image_id || raw.artworks?.[0]?.image_id;
  let igdbCover = '';
  if (horizontalId) igdbCover = igdbImageUrl(horizontalId, 't_1080p');
  else if (raw.cover?.image_id) igdbCover = igdbImageUrl(raw.cover.image_id, 't_cover_big');

  const steamAppId = findSteamAppId(raw);
  if (steamAppId) {
    cover = steamHeaderUrl(steamAppId);
    coverAlt = igdbCover || undefined;
  } else {
    cover = igdbCover;
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
    coverAlt,
    coverHD: raw.artworks?.[0]?.image_id ? igdbImageUrl(raw.artworks[0].image_id, 't_1080p') : undefined,
    year,
    released,
    rating,
    genre: raw.genres?.[0]?.name || 'Неизвестно',
    genres: raw.genres || [],
    tags: (raw.themes || []).map((t) => ({ id: t.id, name: t.name })),
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

    // Берём только результат с совпадающим названием (иначе подставится чужая игра)
    const key = (t: string) => normalizeTitle(t).toLowerCase().replace(/[^a-z0-9а-яё]/g, '');
    const target = key(title);
    if (target.length < 3) return null;

    const match = items.find((it: any) => {
      const k = key(String(it?.name || ''));
      if (!k) return false;
      if (k === target) return true;
      const [short, long] = k.length < target.length ? [k, target] : [target, k];
      return short.length >= 6 && long.startsWith(short);
    });
    if (match?.id) return String(match.id);

    return null;
  } catch {
    return null;
  }
}