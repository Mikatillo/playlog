import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get('game_id');
  const userId = searchParams.get('user_id');

  if (!gameId && !userId) {
    return NextResponse.json({ reviews: [], userVotes: {} });
  }

  try {
    let query = supabase
      .from('public_reviews')
      .select('id, user_id, game_id, game_title, game_cover, rating, text, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (gameId) query = query.eq('game_id', Number(gameId));
    const { data: reviews, error } = await query;
    if (error) {
      console.error('Reviews query error:', error);
      return NextResponse.json({ reviews: [], userVotes: {} });
    }

    if (!reviews || reviews.length === 0) {
      return NextResponse.json({ reviews: [], userVotes: {} });
    }

    const reviewIds = reviews.map((r) => r.id);
    const authorIds = Array.from(new Set(reviews.map((r) => r.user_id)));

    // ВСЕ 4 запроса — ПАРАЛЛЕЛЬНО
    const userVotesPromise = userId
      ? supabase
          .from('review_votes')
          .select('review_id, vote')
          .eq('user_id', userId)
          .in('review_id', reviewIds)
      : Promise.resolve({ data: [] as any[] });

    const [profilesRes, votesRes, commentsRes, userVotesRes] = await Promise.all([
      supabase.from('profiles').select('id, nickname, avatar_url').in('id', authorIds),
      supabase.from('review_votes').select('review_id, vote').in('review_id', reviewIds),
      supabase.from('review_comments').select('review_id').in('review_id', reviewIds),
      userVotesPromise,
    ]);

    const profileMap = new Map((profilesRes.data || []).map((p) => [p.id, p]));

    const likesMap = new Map<string, number>();
    const dislikesMap = new Map<string, number>();
    (votesRes.data || []).forEach((v: any) => {
      if (v.vote === 'like') likesMap.set(v.review_id, (likesMap.get(v.review_id) || 0) + 1);
      else dislikesMap.set(v.review_id, (dislikesMap.get(v.review_id) || 0) + 1);
    });

    const commentsCountMap = new Map<string, number>();
    (commentsRes.data || []).forEach((c: any) => {
      commentsCountMap.set(c.review_id, (commentsCountMap.get(c.review_id) || 0) + 1);
    });

    const result = reviews.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      game_id: r.game_id,
      game_title: r.game_title,
      game_cover: r.game_cover,
      rating: r.rating,
      text: r.text,
      created_at: r.created_at,
      updated_at: r.updated_at,
      nickname: profileMap.get(r.user_id)?.nickname || 'Игрок',
      avatar_url: profileMap.get(r.user_id)?.avatar_url || null,
      likes: likesMap.get(r.id) || 0,
      dislikes: dislikesMap.get(r.id) || 0,
      comments_count: commentsCountMap.get(r.id) || 0,
    }));

    const userVotes: Record<string, string> = {};
    ((userVotesRes as any).data || []).forEach((v: any) => {
      userVotes[v.review_id] = v.vote;
    });

    return NextResponse.json(
      { reviews: result, userVotes },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
        },
      },
    );
  } catch (error: any) {
    console.error('Reviews GET error:', error);
    return NextResponse.json({ reviews: [], userVotes: {} });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, gameId, gameTitle, gameCover, rating, text } = body;

    if (!userId || !gameId || !text || text.length < 3) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { error } = await supabase
      .from('public_reviews')
      .upsert(
        {
          user_id: userId,
          game_id: gameId,
          game_title: gameTitle,
          game_cover: gameCover,
          rating: rating || null,
          text,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,game_id' },
      );

    if (error) {
      console.error('[reviews POST] supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[reviews POST] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const reviewId = searchParams.get('id');
  const userId = searchParams.get('user_id');

  if (!reviewId || !userId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('public_reviews')
      .delete()
      .eq('id', reviewId)
      .eq('user_id', userId);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}