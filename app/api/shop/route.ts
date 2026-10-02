import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get('ids');
  const type = searchParams.get('type');

  try {
    let query = supabase
      .from('shop_items')
      .select('id, type, name, description, price, value, preview_url, order_index')
      .eq('active', true);

    if (idsParam) {
      const ids = idsParam.split(',').filter(Boolean);
      query = query.in('id', ids);
    } else if (type) {
      query = query.eq('type', type);
    }

    query = query.order('order_index', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(
      { items: data || [] },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      },
    );
  } catch (error: any) {
    console.error('[shop] error:', error);
    return NextResponse.json({ items: [] });
  }
}