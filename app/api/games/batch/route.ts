import { NextRequest, NextResponse } from 'next/server';
import { igdbQuery, mapIgdbGame, IgdbGame } from '@/lib/igdb';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get('ids') || '';
  const ids = idsParam
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s))
    .map((s) => Number(s))
    .slice(0, 200);

  if (ids.length === 0) {
    return NextResponse.json({ results: [] });
  }

  try {
    // IGDB позволяет получить до 500 игр одним запросом через where id = (1,2,3)
    const raw: IgdbGame[] = await igdbQuery(
      'games',
      `fields name, game_type, version_parent, rating, rating_count,
       aggregated_rating, aggregated_rating_count,
       total_rating, total_rating_count, first_release_date,
       cover.image_id, artworks.image_id, screenshots.image_id,
       genres.name, platforms.name, summary, videos.video_id,
       external_games.uid, external_games.external_game_source;
       where id = (${ids.join(',')});
       limit ${ids.length};`,
    );

    const results = raw.map(mapIgdbGame);

    return NextResponse.json(
      { results },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      },
    );
  } catch (error) {
    console.error('[IGDB batch] error:', error);
    return NextResponse.json({ error: 'Failed to fetch', results: [] }, { status: 500 });
  }
}