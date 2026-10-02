import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  try {
    const [profileRes, reviewsRes, likesRes, userGamesRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, nickname, full_name, avatar_url, banner_url, banner_gradient, region, city, steam_url, xp, total_games, completed_games, total_hours, coins, active_status_id, active_background_id')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('public_reviews')
        .select('id, game_id, game_title, game_cover, rating, text, created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('profile_likes')
        .select('*', { count: 'exact', head: true })
        .eq('to_user_id', id),
      supabase
        .from('user_games')
        .select('game_id, status, hours, rating, review, updated_at, favorite_order')
        .eq('user_id', id),
    ]);

    const profile = profileRes.data;
    const reviews = reviewsRes.data;
    const likesCount = likesRes.count;
    const userGames = userGamesRes.data || [];

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    let reviewLikesSum = 0;
    if (reviews && reviews.length > 0) {
      const ids = reviews.map((r) => r.id);
      const { data: votes } = await supabase
        .from('review_votes')
        .select('vote')
        .in('review_id', ids);
      reviewLikesSum = (votes || []).filter((v) => v.vote === 'like').length;
    }

    return NextResponse.json(
      {
        profile: {
          id: profile.id,
          nickname: profile.nickname || 'Игрок',
          full_name: profile.full_name || '',
          avatar_url: profile.avatar_url,
          banner_url: profile.banner_url || null,
          banner_gradient: profile.banner_gradient || 'indigo',
          region: profile.region || '',
          city: profile.city || '',
          steam_url: profile.steam_url || '',
          xp: profile.xp || 0,
          totalGames: profile.total_games || 0,
          completedGames: profile.completed_games || 0,
          totalHours: profile.total_hours || 0,
          coins: profile.coins || 0,
          activeStatusId: profile.active_status_id || null,
          activeBackgroundId: profile.active_background_id || null,
        },
        stats: {
          likes: likesCount || 0,
          reviewsCount: reviews?.length || 0,
          reviewLikesSum,
          gamesCount: userGames.length,
        },
        reviews: reviews || [],
        userGames,
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch (error: any) {
    console.error('User profile GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}