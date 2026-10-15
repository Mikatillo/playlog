'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Check, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import type { CustomGameRow } from '@/lib/custom-games';

type Row = CustomGameRow & { approved: boolean };

export default function AdminGamesPage() {
  const { userId } = useAuth();
  const { showToast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('custom_games')
      .select('*')
      .eq('approved', false)
      .order('created_at', { ascending: true });
    setRows((data as Row[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      return;
    }
    supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        setIsAdmin(!!data);
        if (data) load();
      });
  }, [userId, load]);

  const approve = async (r: Row) => {
    setBusyId(r.id);
    const { error } = await supabase.from('custom_games').update({ approved: true }).eq('id', r.id);
    setBusyId(null);
    if (error) return showToast('Не удалось одобрить', 'error');
    setRows((prev) => prev.filter((x) => x.id !== r.id));
    showToast('Карточка одобрена', 'success');
  };

  const reject = async (r: Row) => {
    if (!confirm(`Удалить карточку «${r.title}»?`)) return;
    setBusyId(r.id);
    const { error } = await supabase.from('custom_games').delete().eq('id', r.id);
    setBusyId(null);
    if (error) return showToast('Не удалось удалить', 'error');
    setRows((prev) => prev.filter((x) => x.id !== r.id));
    showToast('Карточка удалена', 'success');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> На главную
        </Link>
        <h1 className="text-2xl font-bold text-white">Карточки на проверке</h1>

        {isAdmin === null || (isAdmin && loading) ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : !isAdmin ? (
          <p className="text-neutral-400">Эта страница доступна только администраторам.</p>
        ) : rows.length === 0 ? (
          <p className="text-neutral-400 bg-neutral-900 border border-neutral-800 rounded-xl p-6">Новых карточек нет.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 sm:p-4 flex gap-3 sm:gap-4">
                <div className="relative w-28 sm:w-40 aspect-[460/215] rounded-lg overflow-hidden bg-neutral-800 flex-shrink-0">
                  {r.cover_url && <Image src={r.cover_url} alt="" fill sizes="160px" className="object-cover" unoptimized />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white truncate">{r.title}</div>
                  <div className="text-xs text-neutral-400 mt-0.5">
                    {r.year || '—'} · {(r.genres || []).join(', ') || 'без жанра'}
                  </div>
                  {r.description && <p className="text-xs text-neutral-500 mt-1.5 line-clamp-3">{r.description}</p>}
                  <Link href={`/user/${r.created_by}`} target="_blank" className="text-[11px] text-indigo-400 hover:underline mt-1.5 inline-block">
                    Автор
                  </Link>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => approve(r)}
                      disabled={busyId === r.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 transition"
                    >
                      <Check className="w-3.5 h-3.5" /> Одобрить
                    </button>
                    <button
                      onClick={() => reject(r)}
                      disabled={busyId === r.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 disabled:opacity-50 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Удалить
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
