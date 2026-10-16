'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const cache = new Map<string, boolean>();

/** Является ли пользователь администратором (есть в таблице admins). */
export function useIsAdmin(userId: string | null | undefined): boolean {
  const [isAdmin, setIsAdmin] = useState(userId ? cache.get(userId) === true : false);

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      return;
    }
    if (cache.has(userId)) {
      setIsAdmin(cache.get(userId)!);
      return;
    }
    let cancelled = false;
    supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        cache.set(userId, !!data);
        if (!cancelled) setIsAdmin(!!data);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return isAdmin;
}
