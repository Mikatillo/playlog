import { NextRequest, NextResponse } from 'next/server';
import { requireUser, serverError, badRequest } from '@/lib/server-auth';

// Покупка выполняется атомарно в Postgres-функции buy_shop_item (см. supabase/security.sql):
// проверка баланса, списание и выдача предмета — в одной транзакции.
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { db } = auth;

  try {
    const body = await request.json().catch(() => null);
    const itemId = body?.itemId;
    if (itemId === undefined || itemId === null || String(itemId).length > 100) {
      return badRequest('Missing params');
    }

    const { data, error } = await db.rpc('buy_shop_item', { p_item_id: String(itemId) });

    if (error) {
      const msg = error.message || '';
      if (msg.includes('item_not_found')) {
        return NextResponse.json({ error: 'Товар не найден' }, { status: 404 });
      }
      if (msg.includes('already_owned')) {
        return NextResponse.json({ error: 'Уже куплено' }, { status: 400 });
      }
      if (msg.includes('insufficient_funds')) {
        return NextResponse.json({ error: 'Недостаточно монет' }, { status: 400 });
      }
      return serverError('shop/buy', error);
    }

    return NextResponse.json({ ok: true, newCoins: data });
  } catch (error) {
    return serverError('shop/buy', error);
  }
}
