import { NextRequest, NextResponse } from 'next/server';
import { igdbQuery, mapIgdbGame, IgdbGame } from '@/lib/igdb';
import { GENRE_MAP, IGDB_GAME_FIELDS, isEdition } from '@/lib/igdb-shared';

// Маппинг ordering фронта → сортировка IGDB
const ORDERING_MAP: Record<string, string> = {
  '-added': 'total_rating_count desc',
  '-rating': 'rating desc',
  '-released': 'first_release_date desc',
  '-metacritic': 'aggregated_rating desc',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(Number(searchParams.get('page') || '1') || 1, 1);
  const pageSize = Math.min(Math.max(Number(searchParams.get('pageSize') || '20') || 20, 1), 50);
  const orderingParam = searchParams.get('ordering') || '-added';
  const genresParam = (searchParams.get('genres') || '').replace(/[^a-z0-9-]/gi, '');

  const offset = (page - 1) * pageSize;

  // IGDB ограничивает offset значением 5000
  if (offset >= 5000) {
    return NextResponse.json({ count: 0, next: null, previous: String(page - 1), results: [] });
  }

  try {
    const where: string[] = ['game_type = 0', 'cover != null', 'version_parent = null'];
    if (genresParam && GENRE_MAP[genresParam]) where.push(`genres = ${GENRE_MAP[genresParam]}`);

    const sort = ORDERING_MAP[orderingParam] || 'total_rating_count desc';

    // Для сортировок по оценке/дате нужен порог, иначе сверху окажутся игры с одной оценкой
    if (orderingParam === '-rating') where.push('rating_count >= 20');
    if (orderingParam === '-metacritic') where.push('aggregated_rating_count >= 5');
    if (orderingParam === '-released') {
      where.push(`first_release_date <= ${Math.floor(Date.now() / 1000)}`);
      where.push('total_rating_count >= 3');
    }
    if (orderingParam === '-added') where.push('total_rating_count >= 3');

    const raw = await igdbQuery<IgdbGame[]>(
      'games',
      `${IGDB_GAME_FIELDS}
       where ${where.join(' & ')};
       sort ${sort};
       limit ${pageSize};
       offset ${offset};`,
      10 * 60 * 1000,
    );

    const results = raw.filter((g) => !isEdition(g.name)).map(mapIgdbGame);

    return NextResponse.json(
      {
        count: results.length,
        next: raw.length === pageSize ? String(page + 1) : null,
        previous: page > 1 ? String(page - 1) : null,
        results,
      },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    );
  } catch (error) {
    console.error('[IGDB games] error:', error);
    return NextResponse.json({ error: 'Failed to fetch', results: [] }, { status: 500 });
  }
}
