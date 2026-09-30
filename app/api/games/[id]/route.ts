import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.RAWG_API_KEY || 'demo';
const BASE_URL = 'https://api.rawg.io/api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const url = `${BASE_URL}/games/${id}?key=${API_KEY}`;
    const response = await fetch(url, { 
      next: { revalidate: 3600 } 
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Game API error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}