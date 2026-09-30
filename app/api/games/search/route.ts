import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.RAWG_API_KEY || 'demo';
const BASE_URL = 'https://api.rawg.io/api';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';

  if (!search) {
    return NextResponse.json({ results: [], count: 0 });
  }

  try {
    const url = `${BASE_URL}/games?key=${API_KEY}&search=${encodeURIComponent(search)}&page_size=20`;
    const response = await fetch(url);
    
    if (!response.ok) {
      return NextResponse.json({ results: [], count: 0, error: 'API error' });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ results: [], count: 0, error: 'Failed' });
  }
}