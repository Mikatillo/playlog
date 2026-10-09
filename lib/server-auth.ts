import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface AuthContext {
  /** Проверенный пользователь (из JWT, а не из тела запроса). */
  user: User;
  /** Supabase-клиент, работающий от имени этого пользователя (RLS применяется). */
  db: SupabaseClient;
}

/**
 * Проверяет заголовок `Authorization: Bearer <access_token>`.
 * Возвращает { user, db } или готовый ответ 401, который нужно вернуть из роута.
 *
 * Использование:
 *   const auth = await requireUser(request);
 *   if (auth instanceof NextResponse) return auth;
 *   const { user, db } = auth;
 */
export async function requireUser(
  request: NextRequest,
): Promise<AuthContext | NextResponse> {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
  }
  const token = match[1].trim();

  const db = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) {
    return NextResponse.json({ error: 'Сессия недействительна' }, { status: 401 });
  }

  return { user: data.user, db };
}

/** Единый безопасный ответ на непредвиденную ошибку (без утечки деталей БД). */
export function serverError(scope: string, error: unknown) {
  console.error(`[${scope}]`, error);
  return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
}

export function badRequest(message = 'Некорректные данные') {
  return NextResponse.json({ error: message }, { status: 400 });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

export const isPosInt = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0;
