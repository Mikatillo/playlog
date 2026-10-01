import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const appid = searchParams.get('appid');

  if (!appid) {
    return NextResponse.json({ error: 'Missing appid' }, { status: 400 });
  }

  try {
    const url = `https://store.steampowered.com/appreviews/${appid}?json=1&language=all&purchase_type=all&num_per_page=0`;
    const response = await fetch(url, { next: { revalidate: 86400 } });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 502 });
    }

    const data = await response.json();
    const summary = data?.query_summary;

    if (!summary || !summary.total_reviews) {
      return NextResponse.json({ percent: null, total: 0 });
    }

    const positive = summary.total_positive || 0;
    const total = summary.total_reviews || 0;
    const percent = total > 0 ? Math.round((positive / total) * 100) : 0;

    return NextResponse.json({
      percent,
      total,
      positive,
      negative: summary.total_negative || 0,
      description: summary.review_score_desc || '',
    });
  } catch (error) {
    console.error('Steam reviews error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}