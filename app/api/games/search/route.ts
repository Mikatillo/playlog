import { NextRequest, NextResponse } from 'next/server';
import { igdbQuery, mapIgdbGame, IgdbGame, findSteamAppIdByTitle, steamHeaderUrl } from '@/lib/igdb';

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
  const search = searchParams.get('search') || '';

  if (!search.trim()) {
    return NextResponse.json({ results: [], count: 0 });
  }

  try {
    const raw: IgdbGame[] = await igdbQuery(
      'games',
      `search "${search}";
       fields name, game_type, version_parent, rating, rating_count,
              aggregated_rating, aggregated_rating_count,
              total_rating, total_rating_count, first_release_date,
              cover.image_id, artworks.image_id, screenshots.image_id,
              genres.name, platforms.name, summary, videos.video_id,
              external_games.uid, external_games.external_game_source;
       limit 30;`,
    );

    const filtered = raw
      .filter((g) => g.game_type === 0)
      .filter((g) => !g.version_parent)
      .filter((g) => !isEdition(g.name))
      .filter((g) => (g.total_rating_count || g.rating_count || 0) >= 3)
      .filter((g) => !!g.cover?.image_id)
      .sort((a, b) => {
        const aCount = a.total_rating_count || a.rating_count || 0;
        const bCount = b.total_rating_count || b.rating_count || 0;
        return bCount - aCount;
      })
      .slice(0, 20);

    // Параллельно ищем Steam appid для игр без Steam в external_games
    const results = await Promise.all(
      filtered.map(async (g) => {
        const mapped = mapIgdbGame(g);

        // Если обложка уже из Steam (mapIgdbGame поставил её через external_games) — не трогаем
        const hasSteamCover = mapped.cover.includes('steamstatic.com');
        if (hasSteamCover) return mapped;

        // Пробуем найти Steam appid по названию
        const appid = await findSteamAppIdByTitle(g.name);
        if (appid) {
          mapped.cover = steamHeaderUrl(appid);
        }
        return mapped;
      }),
    );

    return NextResponse.json(
      { results, count: results.length },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
        },
      },
    );
  } catch (error: any) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch', results: [] },
      { status: 500 },
    );
  }
}