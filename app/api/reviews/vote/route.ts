import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { userId, reviewId, vote } = await request.json();

    if (!userId || !reviewId || !['like', 'dislike'].includes(vote)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Проверяем текущий голос
    const { data: existing } = await supabase
      .from('review_votes')
      .select('vote')
      .eq('user_id', userId)
      .eq('review_id', reviewId)
      .maybeSingle();

    if (existing?.vote === vote) {
      // Тот же голос — убираем (toggle off)
      await supabase
        .from('review_votes')
        .delete()
        .eq('user_id', userId)
        .eq('review_id', reviewId);
      return NextResponse.json({ action: 'removed' });
    }

    // Upsert
    await supabase.from('review_votes').upsert(
      { user_id: userId, review_id: reviewId, vote },
      { onConflict: 'user_id,review_id' },
    );

    return NextResponse.json({ action: existing ? 'changed' : 'added' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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