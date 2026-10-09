import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireUser, serverError, badRequest, isUuid } from '@/lib/server-auth';

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { user, db } = auth;

  try {
    const body = await request.json().catch(() => null);
    const targetId = body?.targetId;
    if (!isUuid(targetId)) return badRequest('Missing');
    if (user.id === targetId) {
      return NextResponse.json({ error: 'Нельзя лайкнуть себя' }, { status: 400 });
    }

    const { data: existing } = await db
      .from('profile_likes')
      .select('from_user_id')
      .eq('from_user_id', user.id)
      .eq('to_user_id', targetId)
      .maybeSingle();

    if (existing) {
      const { error: delErr } = await db
        .from('profile_likes')
        .delete()
        .eq('from_user_id', user.id)
        .eq('to_user_id', targetId);
      if (delErr) throw delErr;
      return NextResponse.json({ action: 'removed' });
    }

    const { error } = await db
      .from('profile_likes')
      .insert({ from_user_id: user.id, to_user_id: targetId });
    if (error && error.code !== '23505') throw error;
    return NextResponse.json({ action: 'added' });
  } catch (error) {
    return serverError('users/like POST', error);
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');
  const targetId = searchParams.get('target_id');
  if (!userId || !targetId) return NextResponse.json({ liked: false });

  const { data } = await supabase
    .from('profile_likes')
    .select('*')
    .eq('from_user_id', userId)
    .eq('to_user_id', targetId)
    .maybeSingle();

  return NextResponse.json({ liked: !!data });
}