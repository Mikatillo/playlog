import { NextRequest, NextResponse } from 'next/server';
import { igdbQuery, mapIgdbGame, IgdbGame } from '@/lib/igdb';
import { GENRE_MAP, IGDB_GAME_FIELDS, isEdition } from '@/lib/igdb-shared';

const PAGE_SIZE = 20;

// Самые популярные игры со Steam-страницей (по числу оценок IGDB), по желанию — одного жанра.
// Возвращает готовые объекты Game. Листается постранично.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const genre = (searchParams.get('genre') || '').replace(/[^a-z0-9-]/gi, '');
  const page = Math.max(1, Number(searchParams.get('page') || '1'));
  const offset = (page - 1) * PAGE_SIZE;

  // IGDB не отдаёт offset больше 5000
  if (offset >= 5000) return NextResponse.json({ results: [], next: false });

  try {
    const where = ['game_type = 0', 'cover != null', 'external_games.external_game_source = 1'];
    if (genre && GENRE_MAP[genre]) where.push(`genres = ${GENRE_MAP[genre]}`);

    const raw = await igdbQuery<IgdbGame[]>(
      'games',
      `${IGDB_GAME_FIELDS}
       where ${where.join(' & ')};
       sort total_rating_count desc;
       limit ${PAGE_SIZE};
       offset ${offset};`,
    );

    const results = raw
      .filter((g) => !g.version_parent)
      .filter((g) => !isEdition(g.name))
      .filter((g) => (g.total_rating_count || g.rating_count || 0) >= 3)
      .map(mapIgdbGame);

    return NextResponse.json(
      { results, next: raw.length === PAGE_SIZE },
      { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } },
    );
  } catch (error) {
    console.error('Steam genre error:', error);
    // Пустой ответ: фронт сам упадёт в запасной вариант (/api/games)
    return NextResponse.json({ results: [], next: false });
  }
}
