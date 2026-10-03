import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query || query.length < 2) {
    return NextResponse.json({ users: [] });
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nickname, full_name, avatar_url, xp')
      .ilike('nickname', `%${query}%`)
      .limit(20);

    if (error) {
      console.error('User search error:', error);
      return NextResponse.json({ users: [] });
    }

    const users = (data || []).map((profile) => ({
      id: profile.id,
      nickname: profile.nickname || 'Игрок',
      full_name: profile.full_name || '',
      avatar_url: profile.avatar_url || null,
      xp: profile.xp || 0,
    }));

    return NextResponse.json(
      { users },
      {
        headers: { 'Cache-Control': 's-maxage=10, stale-while-revalidate=30' },
      }
    );
  } catch (error: any) {
    console.error('User search error:', error);
    return NextResponse.json({ users: [] });
  }
}
