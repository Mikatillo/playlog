import { NextRequest, NextResponse } from 'next/server';
import { igdbQuery, mapIgdbGame, IgdbGame } from '@/lib/igdb';
import { IGDB_GAME_FIELDS, isEdition } from '@/lib/igdb-shared';

// Простые рекомендации по жанрам первых пяти игр пользователя (основной блок — /api/games/for-you)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const excludeIds = (searchParams.get('ids') || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s))
    .map(Number);

  if (excludeIds.length === 0) return NextResponse.json({ results: [] });

  try {
    const sample = excludeIds.slice(0, 5);
    const liked = await igdbQuery<IgdbGame[]>(
      'games',
      `fields genres.name; where id = (${sample.join(',')}); limit ${sample.length};`,
      6 * 3600 * 1000,
    );

    const count = new Map<number, number>();
    liked.forEach((g) => g.genres?.forEach((x) => count.set(x.id, (count.get(x.id) || 0) + 1)));
    const topGenres = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id);

    if (topGenres.length === 0) return NextResponse.json({ results: [] });

    const raw = await igdbQuery<IgdbGame[]>(
      'games',
      `${IGDB_GAME_FIELDS}
       where game_type = 0 & cover != null & version_parent = null & genres = (${topGenres.join(',')})
         & rating_count >= 20;
       sort rating desc; limit 40;`,
      30 * 60 * 1000,
    );

    const excludeSet = new Set(excludeIds);
    const results = raw
      .filter((g) => !excludeSet.has(g.id) && !isEdition(g.name))
      .slice(0, 8)
      .map(mapIgdbGame);

    return NextResponse.json(
      { results },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    );
  } catch (error) {
    console.error('Recommendations error:', error);
    return NextResponse.json({ error: 'Failed to fetch', results: [] }, { status: 500 });
  }
}
