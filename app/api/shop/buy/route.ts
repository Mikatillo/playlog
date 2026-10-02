import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { userId, itemId } = await request.json();
    if (!userId || !itemId) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    const { data: item, error: itemErr } = await supabase
      .from('shop_items')
      .select('id, price')
      .eq('id', itemId)
      .eq('active', true)
      .maybeSingle();

    if (itemErr || !item) {
      return NextResponse.json({ error: 'Товар не найден' }, { status: 404 });
    }

    const { data: existing } = await supabase
      .from('user_inventory')
      .select('item_id')
      .eq('user_id', userId)
      .eq('item_id', itemId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Уже куплено' }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('coins')
      .eq('id', userId)
      .single();

    const currentCoins = profile?.coins || 0;

    if (currentCoins < item.price) {
      return NextResponse.json({ error: 'Недостаточно монет' }, { status: 400 });
    }

    const newCoins = currentCoins - item.price;

    const { error: updErr } = await supabase
      .from('profiles')
      .update({ coins: newCoins })
      .eq('id', userId);

    if (updErr) throw updErr;

    const { error: invErr } = await supabase
      .from('user_inventory')
      .insert({ user_id: userId, item_id: itemId });

    if (invErr) {
      await supabase
        .from('profiles')
        .update({ coins: currentCoins })
        .eq('id', userId);
      throw invErr;
    }

    return NextResponse.json({ ok: true, newCoins });
  } catch (error: any) {
    console.error('[shop/buy] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}