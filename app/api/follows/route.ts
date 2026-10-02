import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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
  try {
    const { userId, targetId } = await request.json();
    if (!userId || !targetId) return NextResponse.json({ error: 'Missing' }, { status: 400 });
    if (userId === targetId) return NextResponse.json({ error: 'Нельзя подписаться на себя' }, { status: 400 });

    const { data: existing } = await supabase
      .from('follows')
      .select('*')
      .eq('follower_id', userId)
      .eq('following_id', targetId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', userId)
        .eq('following_id', targetId);
      return NextResponse.json({ action: 'unfollowed' });
    }

    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: userId, following_id: targetId });
    if (error) throw error;
    return NextResponse.json({ action: 'followed' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}