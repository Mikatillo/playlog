import { NextRequest, NextResponse } from 'next/server';
import { requireUser, serverError } from '@/lib/server-auth';

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { user, db } = auth;

  try {
    const body = await request.json().catch(() => ({}));
    const itemId = body?.itemId;

    // itemId = null → снять всё
    if (!itemId) {
      const { error } = await db
        .from('profiles')
        .update({ active_status_id: null, active_background_id: null })
        .eq('id', user.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    const { data: item, error: itemErr } = await db
      .from('shop_items')
      .select('id, type')
      .eq('id', itemId)
      .maybeSingle();

    if (itemErr || !item) {
      return NextResponse.json({ error: 'Товар не найден' }, { status: 404 });
    }

    const { data: inv } = await db
      .from('user_inventory')
      .select('item_id')
      .eq('user_id', user.id)
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

    const { error } = await db.from('profiles').update(patch).eq('id', user.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError('shop/equip', error);
  }
}
