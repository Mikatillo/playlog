import { NextRequest, NextResponse } from 'next/server';
import { igdbQuery } from '@/lib/igdb';

const DAY = 24 * 60 * 60 * 1000;

interface TimeToBeatRow {
  hastily?: number;
  normally?: number;
  completely?: number;
  count?: number;
}

// Сколько часов уходит на прохождение (по данным игроков IGDB): сюжет и 100%-ная зачистка.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ story: null, full: null });

  try {
    const rows = await igdbQuery<TimeToBeatRow[]>(
      'game_time_to_beats',
      `fields hastily, normally, completely, count; where game_id = ${Number(id)}; limit 1;`,
      DAY,
    );
    const r = rows?.[0];
    // IGDB отдаёт секунды
    const toHours = (sec?: number) => (sec && sec > 0 ? Math.max(1, Math.round(sec / 3600)) : null);
    const story = toHours(r?.normally) ?? toHours(r?.hastily);
    const full = toHours(r?.completely);
    return NextResponse.json(
      { story, full, count: r?.count ?? 0 },
      { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } },
    );
  } catch (error) {
    console.error('time-to-beat error:', error);
    return NextResponse.json({ story: null, full: null });
  }
}
