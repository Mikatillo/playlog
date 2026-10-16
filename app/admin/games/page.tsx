'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Check, Loader2, Pencil, Trash2 } from 'lucide-react';
import CreateGameModal from '@/components/CreateGameModal';
import { invalidateGame } from '@/lib/games-client';
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
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [editId, setEditId] = useState<number | null>(null);

  const load = useCallback(async (which: 'pending' | 'all') => {
    setLoading(true);
    let q = supabase.from('custom_games').select('*');
    if (which === 'pending') q = q.eq('approved', false).order('created_at', { ascending: true });
    else q = q.order('created_at', { ascending: false });
    const { data } = await q;
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
        if (data) load(tab);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, load]);

  const switchTab = (t: 'pending' | 'all') => {
    setTab(t);
    load(t);
  };

  const approve = async (r: Row) => {
    setBusyId(r.id);
    const { error } = await supabase.from('custom_games').update({ approved: true }).eq('id', r.id);
    setBusyId(null);
    if (error) return showToast('Не удалось одобрить', 'error');
    setRows((prev) =>
      tab === 'pending' ? prev.filter((x) => x.id !== r.id) : prev.map((x) => (x.id === r.id ? { ...x, approved: true } : x)),
    );
    showToast('Карточка одобрена', 'success');
  };

  const reject = async (r: Row) => {
    if (!confirm(`Удалить карточку «${r.title}»?`)) return;
    setBusyId(r.id);
    const { error } = await supabase.from('custom_games').delete().eq('id', r.id);
    setBusyId(null);
    if (error) return showToast('Не удалось удалить', 'error');
    invalidateGame(r.id);
    setRows((prev) => prev.filter((x) => x.id !== r.id));
    showToast('Карточка удалена', 'success');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> На главную
        </Link>
        <h1 className="text-2xl font-bold text-white">Карточки игр</h1>
        {isAdmin && (
          <div className="flex gap-2">
            {([['pending', 'На проверке'], ['all', 'Все карточки']] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => switchTab(id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                  tab === id
                    ? 'bg-indigo-500 border-indigo-500 text-white'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {isAdmin === null || (isAdmin && loading) ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : !isAdmin ? (
          <p className="text-neutral-400">Эта страница доступна только администраторам.</p>
        ) : rows.length === 0 ? (
          <p className="text-neutral-400 bg-neutral-900 border border-neutral-800 rounded-xl p-6">{tab === 'pending' ? 'Новых карточек нет.' : 'Карточек пока нет.'}</p>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 sm:p-4 flex gap-3 sm:gap-4">
                <div className="relative w-28 sm:w-40 aspect-[460/215] rounded-lg overflow-hidden bg-neutral-800 flex-shrink-0">
                  {r.cover_url && <Image src={r.cover_url} alt="" fill sizes="160px" className="object-cover" unoptimized />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white truncate">
                    {r.title}
                    {r.approved && <span className="ml-2 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded align-middle">одобрена</span>}
                  </div>
                  <div className="text-xs text-neutral-400 mt-0.5">
                    {r.year || '—'} · {(r.genres || []).join(', ') || 'без жанра'} · скриншотов: {(r.screenshots || []).length}
                  </div>
                  {r.description && <p className="text-xs text-neutral-500 mt-1.5 line-clamp-3">{r.description}</p>}
                  <Link href={`/user/${r.created_by}`} target="_blank" className="text-[11px] text-indigo-400 hover:underline mt-1.5 inline-block">
                    Автор
                  </Link>
                  <div className="flex gap-2 mt-2">
                    {!r.approved && (
                    <button
                      onClick={() => approve(r)}
                      disabled={busyId === r.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 transition"
                    >
                      <Check className="w-3.5 h-3.5" /> Одобрить
                    </button>
                    )}
                    <button
                      onClick={() => setEditId(r.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 border border-neutral-700 text-neutral-200 hover:bg-neutral-700 transition"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Править
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
      {editId !== null && userId && (
        <CreateGameModal
          userId={userId}
          editId={editId}
          onClose={() => setEditId(null)}
          onCreated={(g) => {
            invalidateGame(g.id);
            setEditId(null);
            showToast('Карточка сохранена', 'success');
            load(tab);
          }}
        />
      )}
    </div>
  );
}
