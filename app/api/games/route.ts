import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.RAWG_API_KEY || 'demo';
const BASE_URL = 'https://api.rawg.io/api';

const GAME_FIELDS = [
  'id', 'name', 'background_image', 'released', 'rating',
  'metacritic', 'genres', 'tags', 'platforms', 'playtime',
].join(',');

// Свежие игры = выпущены за последние N лет
const MAX_AGE_YEARS = 3;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') || '1';
  const pageSize = searchParams.get('pageSize') || '20';
  const ordering = searchParams.get('ordering') || '-added';
  const genres = searchParams.get('genres') || '';

  const currentYear = new Date().getFullYear();
  const fromYear = currentYear - MAX_AGE_YEARS;
  const dates = `${fromYear}-01-01,${currentYear}-12-31`;

  try {
    // Запрашиваем СРАЗУ с dates + сортировкой
    let url = `${BASE_URL}/games?key=${API_KEY}&page=${page}&page_size=${pageSize}&ordering=${ordering}&language=rus&fields=${GAME_FIELDS}&dates=${dates}`;
    if (genres) url += `&genres=${genres}`;

    let response = await fetch(url, { next: { revalidate: 3600 } });
    let data = await response.json();

    // Фильтруем на сервере — RAWG может вернуть игры вне диапазона
    let results = (data.results || []).filter((g: any) => {
      const year = Number(g.released?.split('-')[0]) || 0;
      return year >= fromYear;
    });

    // Если пусто — пробуем другой порядок сортировки (metacritic)
    if (results.length === 0) {
      const altOrdering = ordering === '-added' ? '-metacritic' : '-rating';
      let altUrl = `${BASE_URL}/games?key=${API_KEY}&page=${page}&page_size=${pageSize}&ordering=${altOrdering}&language=rus&fields=${GAME_FIELDS}&dates=${dates}`;
      if (genres) altUrl += `&genres=${genres}`;

      response = await fetch(altUrl, { next: { revalidate: 3600 } });
      data = await response.json();
      results = (data.results || []).filter((g: any) => {
        const year = Number(g.released?.split('-')[0]) || 0;
        return year >= fromYear;
      });
    }

    // Если всё ещё пусто — отдаём без dates, но фильтруем на сервере
    if (results.length === 0) {
      let fallbackUrl = `${BASE_URL}/games?key=${API_KEY}&page=${page}&page_size=40&ordering=-released&language=rus&fields=${GAME_FIELDS}`;
      if (genres) fallbackUrl += `&genres=${genres}`;

      response = await fetch(fallbackUrl, { next: { revalidate: 3600 } });
      data = await response.json();
      results = (data.results || []).filter((g: any) => {
        const year = Number(g.released?.split('-')[0]) || 0;
        return year >= fromYear;
      });
    }

    return NextResponse.json(
      {
        count: results.length,
        next: null,
        previous: null,
        results,
      },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    );
  } catch (error) {
    console.error('Games API error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}