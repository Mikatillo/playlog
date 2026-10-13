import { NextRequest, NextResponse } from 'next/server';
import { igdbQuery, mapIgdbGame, IgdbGame } from '@/lib/igdb';

// Маппинг RAWG-slug → IGDB genre IDs (чтобы не менять фронт)
const GENRE_MAP: Record<string, string> = {
  action: '(4,5,8,25)',            // Fighting, Shooter, Platform, Hack&slash
  adventure: '(31)',
  'role-playing-games-rpg': '(12)',
  strategy: '(15)',
  shooter: '(5)',
  puzzle: '(9)',
  racing: '(10)',
  sports: '(14)',
  simulation: '(13)',
  indie: '(32)',
};

// Маппинг RAWG-ordering → IGDB-сортировка
const ORDERING_MAP: Record<string, string> = {
  '-added': 'total_rating_count desc',
  '-rating': 'rating desc',
  '-released': 'first_release_date desc',
  '-metacritic': 'aggregated_rating desc',
};

const EDITION_PATTERNS = [
  /\b(Collector'?s|Premium|Deluxe|Ultimate|Definitive|Gold|Complete|Enhanced|Special|Limited|Diamond|Legendary|Royal|Imperial)\s+Edition\b/i,
  /\bGame of the Year\b/i,
  /\bGOTY\b/i,
  /\bRemaster(ed)?\b/i,
  /\bRemake\b/i,
];

function isEdition(name: string): boolean {
  return EDITION_PATTERNS.some((re) => re.test(name));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(Number(searchParams.get('page') || '1'), 1);
  const pageSize = Math.min(Number(searchParams.get('pageSize') || '20'), 50);
  const orderingParam = searchParams.get('ordering') || '-added';
  const genresParam = searchParams.get('genres') || '';

  const offset = (page - 1) * pageSize;

  // IGDB ограничивает offset значением 5000
  if (offset >= 5000) {
    return NextResponse.json({
      count: 0,
      next: null,
      previous: page > 1 ? String(page - 1) : null,
      results: [],
    });
  }

  try {
    const whereParts: string[] = ['game_type = 0', 'cover != null'];

    if (genresParam && GENRE_MAP[genresParam]) {
      whereParts.push(`genres = ${GENRE_MAP[genresParam]}`);
    }

    const sort = ORDERING_MAP[orderingParam] || 'total_rating_count desc';

    const raw: IgdbGame[] = await igdbQuery(
      'games',
      `fields name, game_type, version_parent, rating, rating_count,
       aggregated_rating, aggregated_rating_count,
       total_rating, total_rating_count, first_release_date,
       cover.image_id, artworks.image_id, screenshots.image_id,
       genres.name, platforms.name, summary, videos.video_id,
       external_games.uid, external_games.external_game_source;
       where ${whereParts.join(' & ')};
       sort ${sort};
       limit ${pageSize};
       offset ${offset};`,
    );

    // Дополнительная фильтрация (editions, пустышки)
    const filtered = raw
      .filter((g) => !g.version_parent)
      .filter((g) => !isEdition(g.name))
      .filter((g) => (g.total_rating_count || g.rating_count || 0) >= 3);

    const results = filtered.map(mapIgdbGame);
    // Если вернулось ровно pageSize — вероятно, есть следующая страница
    const hasNext = raw.length === pageSize;

    return NextResponse.json(
      {
        count: results.length,
        next: hasNext ? String(page + 1) : null,
        previous: page > 1 ? String(page - 1) : null,
        results,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      },
    );
  } catch (error) {
    console.error('[IGDB games] error:', error);
    return NextResponse.json({ error: 'Failed to fetch', results: [] }, { status: 500 });
  }
}