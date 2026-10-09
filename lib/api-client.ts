import { supabase } from '@/lib/supabase';

/**
 * fetch для защищённых API-роутов: добавляет `Authorization: Bearer <token>`
 * из текущей сессии Supabase. Сервер определяет пользователя по токену,
 * а не по userId из тела запроса.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
