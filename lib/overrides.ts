import { supabase } from '@/lib/supabase';
import type { Game } from '@/types/game';
import { isCustomId } from '@/lib/custom-games';

/** Правки админа поверх карточки игры из IGDB. Пустое поле (null) = оставить как в IGDB. */
export interface OverrideRow {
  game_id: number;
  title: string | null;
  cover_url: string | null;
  year: number | null;
  description: string | null;
  genres: string[] | null;
  platforms: string[] | null;
  screenshots: string[] | null;
}

export function applyOverride<T extends Game>(game: T, o: OverrideRow): T {
  const out: T = { ...game };
  if (o.title) out.title = o.title;
  if (o.cover_url) {
    out.cover = o.cover_url;
    out.coverHD = o.cover_url;
    out.coverAlt = undefined;
  }
  if (o.year) out.year = o.year;
  if (o.description) {
    out.description = o.description;
    out.descriptionRaw = o.description;
    out.descriptionRu = undefined;
  }
  if (o.genres && o.genres.length > 0) {
    out.genres = o.genres.map((name, i) => ({ id: i + 1, name }));
    out.genre = o.genres[0];
  }
  if (o.platforms && o.platforms.length > 0) out.platforms = o.platforms;
  if (o.screenshots && o.screenshots.length > 0) {
    out.screenshots = o.screenshots.map((image, i) => ({ id: i + 1, image }));
  }
  return out;
}

/** Накладывает правки админа на список игр. Если таблицы ещё нет или запрос не удался — возвращает игры как есть. */
export async function applyOverrides<T extends Game>(games: T[]): Promise<T[]> {
  const ids = Array.from(new Set(games.map((g) => g.id).filter((id) => !isCustomId(id))));
  if (ids.length === 0) return games;
  try {
    const { data, error } = await supabase.from('game_overrides').select('*').in('game_id', ids.slice(0, 300));
    if (error || !data || data.length === 0) return games;
    const byId = new Map((data as OverrideRow[]).map((r) => [r.game_id, r]));
    return games.map((g) => {
      const o = byId.get(g.id);
      return o ? applyOverride(g, o) : g;
    });
  } catch {
    return games;
  }
}
