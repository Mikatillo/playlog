import { NextRequest, NextResponse } from 'next/server';
import { igdbQuery, mapIgdbGame, IgdbGame } from '@/lib/igdb';

// Издания, коллекционки и ремейки — отсеиваем по названию
const EDITION_PATTERNS = [
  /\b(Collector'?s|Premium|Deluxe|Ultimate|Definitive|Gold|Complete|Enhanced|Special|Limited|Diamond|Legendary|Royal|Imperial)\s+Edition\b/i,
  /\bGame of the Year\b/i,
  /\bGOTY\b/i,
  /\bRemaster(ed)?\b/i,
  /\bRemake\b/i,
  /\bDefinitive Edition\b/i,
  /\bGold Edition\b/i,
  /\bEnhanced Edition\b/i,
];

function isEdition(name: string): boolean {
  return EDITION_PATTERNS.some((re) => re.test(name));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const limit = Math.min(Number(searchParams.get('limit') || '20'), 30);

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  try {
    const raw: IgdbGame[] = await igdbQuery(
      'games',
      `search "${query}";
       fields name, game_type, version_parent, rating, rating_count,
       aggregated_rating, aggregated_rating_count,
       total_rating, total_rating_count, first_release_date,
       cover.image_id, artworks.image_id, screenshots.image_id,
       genres.name, platforms.name, summary, videos.video_id,
       external_games.uid, external_games.category;
       limit 50;`,
    );

    const filtered = raw
      // Только основные игры
      .filter((g) => g.game_type === 0)
      // Без переизданий (version_parent)
      .filter((g) => !g.version_parent)
      // Без изданий, коллекционок, ремейков (по названию)
      .filter((g) => !isEdition(g.name))
      // Минимум 3 оценки
      .filter((g) => (g.total_rating_count || g.rating_count || 0) >= 3)
      // Есть обложка
      .filter((g) => !!g.cover?.image_id)
      // Сортируем по популярности
      .sort((a, b) => {
        const aCount = a.total_rating_count || a.rating_count || 0;
        const bCount = b.total_rating_count || b.rating_count || 0;
        return bCount - aCount;
      })
      .slice(0, limit);

    const results = filtered.map(mapIgdbGame);

    return NextResponse.json({ results, count: results.length });
  } catch (error: any) {
    console.error('[IGDB search] error:', error);
    return NextResponse.json(
      { error: error.message, results: [] },
      { status: 500 },
    );
  }
}