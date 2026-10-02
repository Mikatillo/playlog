import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { userId, itemId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // itemId = null → снять всё
    if (!itemId) {
      const { error } = await supabase
        .from('profiles')
        .update({ active_status_id: null, active_background_id: null })
        .eq('id', userId);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    const { data: item, error: itemErr } = await supabase
      .from('shop_items')
      .select('id, type')
      .eq('id', itemId)
      .maybeSingle();

    if (itemErr || !item) {
      return NextResponse.json({ error: 'Товар не найден' }, { status: 404 });
    }

    const { data: inv } = await supabase
      .from('user_inventory')
      .select('item_id')
      .eq('user_id', userId)
      .eq('item_id', itemId)
      .maybeSingle();

    if (!inv) {
      return NextResponse.json({ error: 'Не куплено' }, { status: 400 });
    }

    const patch: Record<string, string | null> = {};
    if (item.type === 'status') patch.active_status_id = item.id;
    else if (item.type === 'background') patch.active_background_id = item.id;
    else {
      return NextResponse.json({ error: 'Этот тип нельзя применить' }, { status: 400 });
    }

    const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[shop/equip] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}