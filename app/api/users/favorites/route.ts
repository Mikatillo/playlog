import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, gameId, order } = body as {
      userId: string;
      gameId: number;
      order: number;
    };

    if (!userId || !gameId || ![1, 2, 3].includes(order)) {
      return NextResponse.json({ error: 'Missing or invalid params' }, { status: 400 });
    }

    // Освобождаем слот, если он занят другой игрой
    await supabase
      .from('user_games')
      .update({ favorite_order: null })
      .eq('user_id', userId)
      .eq('favorite_order', order);

    // Ставим новую игру в слот
    const { error } = await supabase
      .from('user_games')
      .update({ favorite_order: order })
      .eq('user_id', userId)
      .eq('game_id', gameId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[favorites POST] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const gameId = searchParams.get('gameId');

    if (!userId || !gameId) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    const { error } = await supabase
      .from('user_games')
      .update({ favorite_order: null })
      .eq('user_id', userId)
      .eq('game_id', Number(gameId));

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[favorites DELETE] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}