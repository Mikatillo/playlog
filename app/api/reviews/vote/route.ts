import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireUser, serverError, badRequest, isUuid, isPosInt } from '@/lib/server-auth';

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { user, db } = auth;

  try {
    const body = await request.json().catch(() => null);
    const { reviewId, vote } = body || {};

    if (!reviewId || typeof reviewId !== 'string' || !['like', 'dislike'].includes(vote)) {
      return badRequest('Invalid payload');
    }

    const { data: existing } = await db
      .from('review_votes')
      .select('vote')
      .eq('user_id', user.id)
      .eq('review_id', reviewId)
      .maybeSingle();

    if (existing?.vote === vote) {
      const { error: delErr } = await db
        .from('review_votes')
        .delete()
        .eq('user_id', user.id)
        .eq('review_id', reviewId);
      if (delErr) throw delErr;
      return NextResponse.json({ action: 'removed' });
    }

    const { error } = await db.from('review_votes').upsert(
      { user_id: user.id, review_id: reviewId, vote },
      { onConflict: 'user_id,review_id' },
    );
    if (error) throw error;

    return NextResponse.json({ action: existing ? 'changed' : 'added' });
  } catch (error) {
    return serverError('reviews/vote POST', error);
  }
}

// Возвращает голос текущего пользователя для рецензии
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');
  const reviewIds = searchParams.get('review_ids')?.split(',').filter(Boolean) || [];

  if (!userId || reviewIds.length === 0) {
    return NextResponse.json({ votes: {} });
  }

  const { data } = await supabase
    .from('review_votes')
    .select('review_id, vote')
    .eq('user_id', userId)
    .in('review_id', reviewIds);

  const votes: Record<string, string> = {};
  (data || []).forEach((v) => {
    votes[v.review_id] = v.vote;
  });

  return NextResponse.json({ votes });
}