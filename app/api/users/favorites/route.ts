import { NextRequest, NextResponse } from 'next/server';
import { requireUser, serverError, badRequest, isPosInt } from '@/lib/server-auth';

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { user, db } = auth;

  try {
    const body = await request.json().catch(() => null);
    const { gameId, order } = body || {};

    if (!isPosInt(gameId) || ![1, 2, 3].includes(order)) {
      return badRequest('Missing or invalid params');
    }

    // Освобождаем слот, если он занят другой игрой
    const { error: freeErr } = await db
      .from('user_games')
      .update({ favorite_order: null })
      .eq('user_id', user.id)
      .eq('favorite_order', order);
    if (freeErr) throw freeErr;

    // Ставим новую игру в слот
    const { error } = await db
      .from('user_games')
      .update({ favorite_order: order })
      .eq('user_id', user.id)
      .eq('game_id', gameId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError('favorites POST', error);
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { user, db } = auth;

  try {
    const gameId = Number(new URL(request.url).searchParams.get('gameId'));
    if (!isPosInt(gameId)) return badRequest('Missing params');

    const { error } = await db
      .from('user_games')
      .update({ favorite_order: null })
      .eq('user_id', user.id)
      .eq('game_id', gameId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError('favorites DELETE', error);
  }
}
