import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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
  try {
    const { userId, reviewId, text } = await request.json();

    if (!userId || !reviewId || !text || !text.trim()) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('review_comments')
      .insert({
        user_id: userId,
        review_id: reviewId,
        text: text.trim().slice(0, 500),
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ comment: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const userId = searchParams.get('user_id');

  if (!id || !userId) return NextResponse.json({ error: 'Missing' }, { status: 400 });

  const { error } = await supabase
    .from('review_comments')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}