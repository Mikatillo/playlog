import { NextResponse } from 'next/server';
import { igdbQuery } from '@/lib/igdb';

export async function GET() {
  try {
    // Ищем The Last of Us Part I через поиск
    const searchResult = await igdbQuery(
      'games',
      `search "The Last of Us Part I";
       fields name, id, external.steam, ports.id, ports.name, ports.external.steam;
       limit 3;`,
    );

    return NextResponse.json({
      searchResult,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}