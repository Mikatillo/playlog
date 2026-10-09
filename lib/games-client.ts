import type { Game } from '@/types/game';
import { mapRawgGame, type RawgGame } from '@/lib/rawg';

// Кеш игр на клиенте: переживает переходы между страницами (память модуля)
// и перезагрузку вкладки (sessionStorage).
const memory = new Map<number, Game>();
const STORAGE_KEY = 'playlog:games-cache-v1';
const MAX_STORED = 300;
let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const list: Game[] = JSON.parse(raw);
    list.forEach((g) => memory.set(g.id, g));
  } catch {}
}

function persist() {
  try {
    const list = Array.from(memory.values()).slice(-MAX_STORED);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

const CHUNK = 40;

/**
 * Загружает игры по id. Запрашивает с сервера только те, которых ещё нет в кеше,
 * порциями по 40 штук и параллельно. Порядок результата соответствует порядку ids.
 */
export async function fetchGamesByIds(ids: number[]): Promise<Game[]> {
  hydrate();
  const missing = ids.filter((id) => !memory.has(id));

  if (missing.length > 0) {
    const chunks: number[][] = [];
    for (let i = 0; i < missing.length; i += CHUNK) chunks.push(missing.slice(i, i + CHUNK));

    await Promise.all(
      chunks.map(async (chunk) => {
        try {
          const res = await fetch(`/api/games/batch?ids=${chunk.join(',')}`);
          if (!res.ok) return;
          const data = await res.json();
          (data.results || []).forEach((raw: RawgGame) => {
            const game = mapRawgGame(raw);
            memory.set(game.id, game);
          });
        } catch (err) {
          console.error('Games batch error:', err);
        }
      }),
    );
    persist();
  }

  return ids.map((id) => memory.get(id)).filter((g): g is Game => !!g);
}
