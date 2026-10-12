import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gameId = parseInt(id);

  if (isNaN(gameId)) {
    return NextResponse.json({ error: 'Invalid game ID' }, { status: 400 });
  }

  try {
    // Найти всех пользователей, которые играли в эту игру
    const { data: userGames, error } = await supabase
      .from('user_games')
      .select('user_id, hours')
      .eq('game_id', gameId)
      .gt('hours', 0)
      .order('hours', { ascending: false })
      .limit(10);

    if (error) throw error;

    if (!userGames || userGames.length === 0) {
      return NextResponse.json({ teammates: [] });
    }

    // Получить профили этих пользователей
    const userIds = userGames.map((ug) => ug.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, nickname, avatar_url')
      .in('id', userIds);

    if (profilesError) throw profilesError;

    // Объединить данные
    const teammates = (profiles || []).map((profile) => {
      const userGame = userGames.find((ug) => ug.user_id === profile.id);
      return {
        id: profile.id,
        nickname: profile.nickname || 'Игрок',
        avatar_url: profile.avatar_url,
        hours_played: userGame?.hours || 0,
      };
    });

    return NextResponse.json({ teammates });
  } catch (error: any) {
    console.error('Teammates error:', error);
    return NextResponse.json({ teammates: [] });
  }
}
