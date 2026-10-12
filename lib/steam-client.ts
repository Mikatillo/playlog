import type { Game } from '@/types/game';
import { mapRawgGame, type RawgGame } from '@/lib/rawg';

export interface SteamTopItem {
  game: Game;
  rank: number;
  players: number;
}

// Один запрос на все блоки страницы (герой + каталог), повторно — из памяти на 10 минут
let cached: { at: number; promise: Promise<SteamTopItem[]> } | null = null;

export function fetchSteamTop(force = false): Promise<SteamTopItem[]> {
  if (!force && cached && Date.now() - cached.at < 10 * 60 * 1000) return cached.promise;

  const promise = fetch('/api/steam/steam-popular?limit=24')
    .then((r) => (r.ok ? r.json() : { results: [] }))
    .then((data) =>
      ((data.results || []) as (RawgGame & { steam?: { rank: number; players: number } })[]).map(
        (g, i) => ({
          game: mapRawgGame(g),
          rank: g.steam?.rank ?? i + 1,
          players: g.steam?.players ?? 0,
        }),
      ),
    )
    .catch(() => [] as SteamTopItem[]);

  cached = { at: Date.now(), promise };
  // пустой ответ не кэшируем, чтобы следующая попытка могла сработать
  promise.then((list) => {
    if (list.length === 0 && cached?.promise === promise) cached = null;
  });
  return promise;
}
