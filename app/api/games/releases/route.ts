import { NextRequest, NextResponse } from 'next/server';
import { igdbQuery, mapIgdbGame, IgdbGame } from '@/lib/igdb';
import { IGDB_GAME_FIELDS } from '@/lib/igdb-shared';
import { applyOverrides } from '@/lib/overrides';

function startOfDay(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m, d) / 1000);
}

// Календарь релизов: ожидаемые игры (по «хайпу» IGDB) для будущих дат и популярные для прошедших.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get('year'));
  const month = Number(searchParams.get('month'));

  try {
    const nowSec = Math.floor(Date.now() / 1000);
    let from: number;
    let to: number;

    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) {
      from = startOfDay(year, month - 1, 1);
      to = startOfDay(year, month, 1) - 1;
    } else {
      const today = new Date();
      from = startOfDay(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
      to = from + 183 * 24 * 3600;
    }

    const future = to > nowSec;
    const notable = '(hypes >= 2 | total_rating_count >= 5 | aggregated_rating_count >= 3)';

    const raw = await igdbQuery<IgdbGame[]>(
      'games',
      `${IGDB_GAME_FIELDS}
       where game_type = (0,8,9) & cover != null & version_parent = null
         & first_release_date >= ${from} & first_release_date <= ${to} & ${notable};
       sort ${future ? 'hypes desc' : 'total_rating_count desc'};
       limit 60;`,
      15 * 60 * 1000,
    );

    const results = (await applyOverrides(raw.map(mapIgdbGame)))
      .filter((g) => g.year > 0)
      .sort((a, b) => (a.released || '').localeCompare(b.released || ''))
      .slice(0, 40);

    return NextResponse.json(
      { results },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    );
  } catch (error) {
    console.error('Releases API error:', error);
    return NextResponse.json({ results: [] });
  }
}
