import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireUser, serverError, badRequest, isUuid, isPosInt } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const reviewId = searchParams.get('review_id');

  if (!reviewId) {
    return NextResponse.json({ comments: [] });
  }

  const { data: comments, error } = await supabase
    .from('review_comments')
    .select('id, user_id, text, created_at')
    .eq('review_id', reviewId)
    .order('created_at', { ascending: true });

  if (error || !comments) {
    return NextResponse.json({ comments: [] });
  }

  const userIds = Array.from(new Set(comments.map((c) => c.user_id)));
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, nickname, avatar_url')
    .in('id', userIds);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  const result = comments.map((c) => ({
    id: c.id,
    user_id: c.user_id,
    text: c.text,
    created_at: c.created_at,
    nickname: profileMap.get(c.user_id)?.nickname || 'Игрок',
    avatar_url: profileMap.get(c.user_id)?.avatar_url || null,
  }));

  return NextResponse.json({ comments: result });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { user, db } = auth;

  try {
    const body = await request.json().catch(() => null);
    const { reviewId, text } = body || {};

    if (!reviewId || typeof reviewId !== 'string' || typeof text !== 'string' || !text.trim()) {
      return badRequest('Invalid payload');
    }

    const { data, error } = await db
      .from('review_comments')
      .insert({
        user_id: user.id,
        review_id: reviewId,
        text: text.trim().slice(0, 500),
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ comment: data });
  } catch (error) {
    return serverError('reviews/comments POST', error);
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { user, db } = auth;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return badRequest('Missing');

  const { error } = await db
    .from('review_comments')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return serverError('reviews/comments DELETE', error);
  return NextResponse.json({ ok: true });
}
