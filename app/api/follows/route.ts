import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireUser, serverError, badRequest, isUuid } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');
  const targetId = searchParams.get('target_id');

  if (!userId || !targetId) return NextResponse.json({ following: false, count: 0 });

  const { data } = await supabase
    .from('follows')
    .select('*')
    .eq('follower_id', userId)
    .eq('following_id', targetId)
    .maybeSingle();

  const { count } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', targetId);

  return NextResponse.json({ following: !!data, count: count || 0 });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { user, db } = auth;

  try {
    const body = await request.json().catch(() => null);
    const targetId = body?.targetId;
    if (!isUuid(targetId)) return badRequest('Missing');
    if (user.id === targetId) {
      return NextResponse.json({ error: 'Нельзя подписаться на себя' }, { status: 400 });
    }

    const { data: existing } = await db
      .from('follows')
      .select('follower_id')
      .eq('follower_id', user.id)
      .eq('following_id', targetId)
      .maybeSingle();

    if (existing) {
      const { error: delErr } = await db
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetId);
      if (delErr) throw delErr;
      return NextResponse.json({ action: 'unfollowed' });
    }

    const { error } = await db
      .from('follows')
      .insert({ follower_id: user.id, following_id: targetId });
    // 23505 — уже подписан (параллельный запрос): считаем успехом
    if (error && error.code !== '23505') throw error;
    return NextResponse.json({ action: 'followed' });
  } catch (error) {
    return serverError('follows POST', error);
  }
}
