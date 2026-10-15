import { supabase } from '@/lib/supabase';
import type { Game } from '@/types/game';

/** Игры, созданные пользователями, живут в таблице custom_games с id начиная с 1 млрд (id IGDB намного меньше). */
export const CUSTOM_ID_START = 1_000_000_000;

export const isCustomId = (id: number) => id >= CUSTOM_ID_START;

export interface CustomGameRow {
  id: number;
  created_by: string;
  title: string;
  cover_url: string | null;
  year: number | null;
  description: string | null;
  genres: string[] | null;
  platforms: string[] | null;
  created_at: string;
}

export function mapCustomGame(row: CustomGameRow): Game {
  const genres = (row.genres || []).map((name, i) => ({ id: i + 1, name }));
  return {
    id: row.id,
    title: row.title,
    cover: row.cover_url || '',
    year: row.year || new Date(row.created_at).getFullYear(),
    rating: 0,
    genre: genres[0]?.name || 'Неизвестно',
    genres,
    description: row.description || '',
    descriptionRaw: undefined,
    platforms: row.platforms || [],
    screenshots: [],
  };
}

export async function fetchCustomGames(ids: number[]): Promise<Game[]> {
  const list = ids.filter(isCustomId);
  if (list.length === 0) return [];
  const { data, error } = await supabase.from('custom_games').select('*').in('id', list);
  if (error || !data) return [];
  const byId = new Map((data as CustomGameRow[]).map((r) => [r.id, mapCustomGame(r)]));
  return list.map((id) => byId.get(id)).filter((g): g is Game => !!g);
}

export async function searchCustomGames(term: string): Promise<Game[]> {
  const safe = term.replace(/[%_,()]/g, ' ').trim().slice(0, 80);
  if (safe.length < 2) return [];
  const { data, error } = await supabase
    .from('custom_games')
    .select('*')
    .ilike('title', `%${safe}%`)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error || !data) return [];
  return (data as CustomGameRow[]).map(mapCustomGame);
}
