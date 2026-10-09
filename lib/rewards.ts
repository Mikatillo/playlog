import { supabase } from '@/lib/supabase';

/**
 * XP и монеты начисляет база данных (триггер на user_games).
 * После сохранения игры клиент только читает актуальные значения.
 */
export async function fetchRewards(
  userId: string,
): Promise<{ xp: number; coins: number } | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('xp, coins')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return { xp: data.xp || 0, coins: data.coins || 0 };
}
