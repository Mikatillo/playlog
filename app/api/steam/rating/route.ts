import { NextRequest, NextResponse } from 'next/server';

interface CacheEntry {
  appid: number | null;
  percent: number | null;
  total: number;
  description: string;
  cachedAt: number;
}

// Кеш на сервере (в памяти процесса)
const cache = new Map<string, CacheEntry>();
const HTTP_CACHE = { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } };
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 часа

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/[:\-–—_,.!?'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function searchSteam(name: string): Promise<{ appid: number; name: string }[]> {
  const url = `https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(name)}`;

  const res = await fetch(url, {
    next: { revalidate: 86400 },
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; playlog/1.0)',
      'Accept': 'application/json',
    },
  });

  if (!res.ok) throw new Error(`Steam search HTTP ${res.status}`);

  const data = await res.json();
  if (!Array.isArray(data)) return [];

  return data
    .map((item: any) => ({
      appid: Number(item.appid),
      name: String(item.name || ''),
    }))
    .filter((g) => g.appid && g.name);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');

  if (!name || !name.trim()) {
    return NextResponse.json({ appid: null, percent: null });
  }

  // Проверяем серверный кеш
  const cached = cache.get(name);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return NextResponse.json({
      appid: cached.appid,
      percent: cached.percent,
      total: cached.total,
      description: cached.description,
    }, HTTP_CACHE);
  }

  try {
    const results = await searchSteam(name);

    if (results.length === 0) {
      const empty: CacheEntry = {
        appid: null,
        percent: null,
        total: 0,
        description: '',
        cachedAt: Date.now(),
      };
      cache.set(name, empty);
      return NextResponse.json({ appid: null, percent: null }, HTTP_CACHE);
    }

    const target = normalize(name);

    let best = results.find((r) => normalize(r.name) === target);
    if (!best) best = results.find((r) => normalize(r.name).startsWith(target));
    if (!best) best = results.find((r) => normalize(r.name).includes(target));
    if (!best) best = results[0];

    const revRes = await fetch(
      `https://store.steampowered.com/appreviews/${best.appid}?json=1&language=all&purchase_type=all&num_per_page=0`,
      {
        next: { revalidate: 86400 },
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; playlog/1.0)',
        },
      },
    );

    if (!revRes.ok) {
      return NextResponse.json({ appid: best.appid, percent: null });
    }

    const revData = await revRes.json();
    const summary = revData?.query_summary;

    if (!summary || !summary.total_reviews) {
      const entry: CacheEntry = {
        appid: best.appid,
        percent: null,
        total: 0,
        description: '',
        cachedAt: Date.now(),
      };
      cache.set(name, entry);
      return NextResponse.json({ appid: best.appid, percent: null, total: 0 }, HTTP_CACHE);
    }

    const positive = summary.total_positive || 0;
    const total = summary.total_reviews || 0;
    const percent = total > 0 ? Math.round((positive / total) * 100) : 0;
    const description = summary.review_score_desc || '';

    const entry: CacheEntry = {
      appid: best.appid,
      percent,
      total,
      description,
      cachedAt: Date.now(),
    };
    cache.set(name, entry);

    return NextResponse.json({
      appid: best.appid,
      percent,
      total,
      description,
    }, HTTP_CACHE);
  } catch (error: any) {
    console.error('[steam/rating] ошибка:', error.message);
    // Ошибку не кешируем — попробуем в следующий раз
    return NextResponse.json({ appid: null, percent: null, error: error.message });
  }
}