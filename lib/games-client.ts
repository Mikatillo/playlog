import type { Game } from '@/types/game';

// Новая версия кеша: старые обложки загружаются заново.
const memory = new Map<number, Game>();
const STORAGE_KEY = 'playlog:games-cache-v2';
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

export async function fetchGamesByIds(ids: number[]): Promise<Game[]> {
  hydrate();
  const missing = ids.filter((id) => !memory.has(id));

  if (missing.length > 0) {
    const chunks: number[][] = [];
    for (let i = 0; i < missing.length; i += CHUNK) {
      chunks.push(missing.slice(i, i + CHUNK));
    }

    await Promise.all(
      chunks.map(async (chunk) => {
        try {
          const res = await fetch(`/api/games/batch?ids=${chunk.join(',')}`);
          if (!res.ok) return;
          const data = await res.json();
          ((data.results || []) as Game[]).forEach((game) => {
            memory.set(game.id, game);
          });
        } catch (err) {
          console.error('Games batch error:', err);
        }
      }),
    );
    persist();
  }

  return ids
    .map((id) => memory.get(id))
    .filter((g): g is Game => !!g);
}

export function invalidateGame(id: number) {
  hydrate();
  memory.delete(id);
  persist();
}