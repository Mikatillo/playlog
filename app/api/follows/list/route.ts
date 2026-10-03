import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');
  const type = searchParams.get('type'); // 'following' | 'followers'

  if (!userId || !type) {
    return NextResponse.json(
      { error: 'Missing user_id or type' },
      { status: 400 },
    );
  }

  if (type !== 'following' && type !== 'followers') {
    return NextResponse.json(
      { error: 'Invalid type. Must be "following" or "followers"' },
      { status: 400 },
    );
  }

  try {
    // Определяем какую колонку джойним с profiles
    const joinColumn = type === 'following' ? 'following_id' : 'follower_id';
    const filterColumn = type === 'following' ? 'follower_id' : 'following_id';

    const { data, error } = await supabase
      .from('follows')
      .select(`
        created_at,
        profiles!follows_${joinColumn}_fkey (
          id,
          nickname,
          full_name,
          avatar_url,
          xp
        )
      `)
      .eq(filterColumn, userId)
      .order('created_at', { ascending: false });

    if (error) {
      // Fallback: если джойн не сработал (например, нет FK constraint),
      // делаем два запроса
      const { data: followsData, error: followsError } = await supabase
        .from('follows')
        .select(`${joinColumn}, created_at`)
        .eq(filterColumn, userId)
        .order('created_at', { ascending: false });

      if (followsError) throw followsError;

      if (!followsData || followsData.length === 0) {
        return NextResponse.json({ users: [] });
      }

      const targetIds = followsData.map((f: any) => f[joinColumn]);

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, nickname, full_name, avatar_url, xp')
        .in('id', targetIds);

      const profileMap = new Map(
        (profilesData || []).map((p: any) => [p.id, p]),
      );

      const users = followsData.map((f: any) => {
        const profile = profileMap.get(f[joinColumn]);
        return profile
          ? {
              id: profile.id,
              nickname: profile.nickname || 'Игрок',
              full_name: profile.full_name || '',
              avatar_url: profile.avatar_url || null,
              xp: profile.xp || 0,
              followed_at: f.created_at,
            }
          : null;
      }).filter(Boolean);

      return NextResponse.json(
        { users },
        {
          headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' },
        },
      );
    }

    // Если джойн сработал
    const users = (data || []).map((item: any) => {
      const profile = item.profiles;
      return {
        id: profile.id,
        nickname: profile.nickname || 'Игрок',
        full_name: profile.full_name || '',
        avatar_url: profile.avatar_url || null,
        xp: profile.xp || 0,
        followed_at: item.created_at,
      };
    });

    return NextResponse.json(
      { users },
      {
        headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' },
      },
    );
  } catch (error: any) {
    console.error('Follows list error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }
}
