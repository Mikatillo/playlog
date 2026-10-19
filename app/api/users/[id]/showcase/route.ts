import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireUser, badRequest, isUuid, serverError } from '@/lib/server-auth';
import { parseShowcase } from '@/lib/profile-showcase';
import { ACHIEVEMENTS, type AchievementStats } from '@/lib/achievements';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  const { id } = await params;
  if (!isUuid(id)) return badRequest('Некорректный профиль');
  try {
    const { data, error } = await supabase.from('profile_showcases').select('slots').eq('user_id', id).maybeSingle();
    if (error) return NextResponse.json({ error: 'Не удалось загрузить витрину' }, { status: 503 });
    return NextResponse.json({ slots: data ? parseShowcase(data.slots) : null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return serverError('showcase GET', error); }
}

export async function PUT(request: NextRequest, { params }: Context) {
  const { id } = await params;
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.user.id !== id) return NextResponse.json({ error: 'Можно менять только свою витрину' }, { status: 403 });
  try {
    const body = await request.json().catch(() => null);
    const slots = parseShowcase(body?.slots);
    if (!slots) return badRequest('Нужны четыре корректных блока');
    const [{ data: games, error: gamesError }, { data: reviews, error: reviewsError }] = await Promise.all([
      auth.db.from('user_games').select('game_id, status, hours, rating, review').eq('user_id', id),
      auth.db.from('public_reviews').select('id').eq('user_id', id),
    ]);
    if (gamesError || reviewsError) throw gamesError || reviewsError;
    const rows = games || [];
    const stats: AchievementStats = {
      total: rows.length,
      completed: rows.filter((g) => g.status === 'completed').length,
      playing: rows.filter((g) => g.status === 'playing').length,
      want: rows.filter((g) => g.status === 'want').length,
      dropped: rows.filter((g) => g.status === 'dropped').length,
      totalHours: rows.reduce((sum, g) => sum + (g.hours || 0), 0),
      ratedGames: rows.filter((g) => g.rating > 0).length,
      reviewsCount: rows.filter((g) => g.review && g.review.length > 0).length,
    };
    for (const slot of slots) {
      if (slot.type === 'game' && !rows.some((g) => g.game_id === slot.gameId)) return badRequest('Выбери игру из своей библиотеки');
      if (slot.type === 'review' && !reviews?.some((r) => r.id === slot.reviewId)) return badRequest('Выбери свою опубликованную рецензию');
      if (slot.type === 'achievement') {
        const achievement = ACHIEVEMENTS.find((a) => a.id === slot.achievementId)!;
        if (achievement.getValue(stats) < achievement.thresholds[0]) return badRequest('Это достижение ещё не получено');
      }
    }
    const { data, error } = await auth.db.from('profile_showcases').upsert({ user_id: id, slots, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).select('slots').single();
    if (error) throw error;
    return NextResponse.json({ slots: parseShowcase(data.slots) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return serverError('showcase PUT', error); }
}
