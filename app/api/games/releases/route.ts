import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.RAWG_API_KEY || 'demo';
const BASE_URL = 'https://api.rawg.io/api';

const FIELDS = [
  'id', 'name', 'background_image', 'released', 'rating',
  'metacritic', 'genres', 'platforms', 'tba',
].join(',');

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get('year');
  const monthParam = searchParams.get('month');

  try {
    let dates: string;

    if (yearParam && monthParam) {
      const year = Number(yearParam);
      const month = Number(monthParam);
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      dates = `${start},${end}`;
    } else {
      const today = new Date();
      const future = new Date();
      future.setMonth(future.getMonth() + 6);
      dates = `${fmt(today)},${fmt(future)}`;
    }

    // Основной запрос
    const primaryUrl = `${BASE_URL}/games?key=${API_KEY}&dates=${dates}&ordering=released&page_size=40&language=rus&fields=${FIELDS}`;
    let response = await fetch(primaryUrl, { next: { revalidate: 3600 } });

    if (!response.ok) {
      // Резервный запрос — без dates, только сортировка по дате выхода
      const fallbackUrl = `${BASE_URL}/games?key=${API_KEY}&ordering=-released&page_size=40&language=rus&fields=${FIELDS}`;
      response = await fetch(fallbackUrl, { next: { revalidate: 3600 } });
    }

    if (!response.ok) {
      // Второй резерв — популярные игры с датой
      const lastResortUrl = `${BASE_URL}/games?key=${API_KEY}&ordering=-added&page_size=40&language=rus&fields=${FIELDS}`;
      response = await fetch(lastResortUrl, { next: { revalidate: 3600 } });
    }

    if (!response.ok) {
      return NextResponse.json({ results: [] });
    }

    const data = await response.json();
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
  } catch (error) {
    console.error('Releases API error:', error);
    return NextResponse.json({ results: [] });
  }
}