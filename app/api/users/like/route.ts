import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { userId, targetId } = await request.json();
    if (!userId || !targetId) return NextResponse.json({ error: 'Missing' }, { status: 400 });
    if (userId === targetId) return NextResponse.json({ error: 'Нельзя лайкнуть себя' }, { status: 400 });

    const { data: existing } = await supabase
      .from('profile_likes')
      .select('*')
      .eq('from_user_id', userId)
      .eq('to_user_id', targetId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('profile_likes')
        .delete()
        .eq('from_user_id', userId)
        .eq('to_user_id', targetId);
      return NextResponse.json({ action: 'removed' });
    }

    const { error } = await supabase
      .from('profile_likes')
      .insert({ from_user_id: userId, to_user_id: targetId });
    if (error) throw error;
    return NextResponse.json({ action: 'added' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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