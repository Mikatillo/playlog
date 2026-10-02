import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');
  const scope = searchParams.get('scope') || 'user';

  try {
    let query = supabase
      .from('activity_feed')
      .select('id, user_id, type, game_id, game_title, game_cover, hours, rating, preview, created_at')
      .order('created_at', { ascending: false })
      .limit(30);

    if (scope === 'user' && userId) {
      query = query.eq('user_id', userId);
    } else if (scope === 'feed' && userId) {
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);
      const ids = [userId, ...((follows || []).map((f) => f.following_id))];
      query = query.in('user_id', ids);
    }

    const { data: activities } = await query;

    if (!activities || activities.length === 0) {
      return NextResponse.json({ activities: [] });
    }

    const authorIds = Array.from(new Set(activities.map((a) => a.user_id)));
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, nickname, avatar_url')
      .in('id', authorIds);
    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const result = activities.map((a) => ({
      id: a.id,
      user_id: a.user_id,
      type: a.type,
      game_id: a.game_id,
      game_title: a.game_title,
      game_cover: a.game_cover,
      hours: a.hours,
      rating: a.rating,
      preview: a.preview,
      created_at: a.created_at,
      nickname: profileMap.get(a.user_id)?.nickname || 'Игрок',
      avatar_url: profileMap.get(a.user_id)?.avatar_url || null,
    }));

    return NextResponse.json({ activities: result });
  } catch (error: any) {
    console.error('[activity GET] error:', error);
    return NextResponse.json({ activities: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, type, gameId, gameTitle, gameCover, hours, rating, preview } = body;

    if (!userId || !type || !gameId) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    const { error } = await supabase.from('activity_feed').insert({
      user_id: userId,
      type,
      game_id: gameId,
      game_title: gameTitle,
      game_cover: gameCover,
      hours: hours || 0,
      rating: rating || null,
      preview: preview || null,
    });

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[activity POST] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}