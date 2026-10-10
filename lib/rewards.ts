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

/** Текст для уведомления о награде или null, если награды не было. */
export function describeGain(xpGain: number, coinGain: number): string | null {
  const parts: string[] = [];
  if (xpGain > 0) parts.push(`+${xpGain} XP`);
  if (coinGain > 0) parts.push(`+${coinGain} монет`);
  return parts.length ? `Награда: ${parts.join(' · ')}` : null;
}
