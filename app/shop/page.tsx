'use client';

import { authFetch } from '@/lib/api-client';
import { useEffect, useState } from 'react';
import {
  Loader2, Coins, Star, Image as ImageIcon, Check, Lock, ShoppingBag,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

interface ShopItem {
  id: string;
  type: 'status' | 'background' | string;
  name: string;
  description: string | null;
  price: number;
  value: string;
  preview_url: string | null;
}

export default function ShopPage() {
  const { userId, profile, setProfile } = useAuth();
  const { showToast } = useToast();

  const [items, setItems] = useState<ShopItem[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [activeBg, setActiveBg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<'status' | 'background'>('status');

  const coins = profile?.coins || 0;

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      const [itemsRes, invRes, profRes] = await Promise.all([
        fetch('/api/shop').then((r) => r.json()).catch(() => ({ items: [] })),
        supabase.from('user_inventory').select('item_id').eq('user_id', userId),
        supabase
          .from('profiles')
          .select('active_status_id, active_background_id, coins')
          .eq('id', userId)
          .maybeSingle(),
      ]);

      setItems(itemsRes.items || []);
      setOwned(new Set((invRes.data || []).map((r: any) => r.item_id)));
      setActiveStatus(profRes.data?.active_status_id || null);
      setActiveBg(profRes.data?.active_background_id || null);

      if (profRes.data && typeof profRes.data.coins === 'number') {
        setProfile((prev) => ({ ...prev, coins: profRes.data!.coins }));
      }

      setLoading(false);
    };
    load();
  }, [userId, setProfile]);

  const handleBuy = async (item: ShopItem) => {
    if (!userId) {
      showToast('Войди, чтобы покупать', 'info');
      return;
    }
    setBusyId(item.id);
    try {
      const res = await authFetch('/api/shop/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, itemId: item.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');
      setOwned((prev) => new Set(prev).add(item.id));
      setProfile((prev) => ({ ...prev, coins: data.newCoins }));
      showToast('Куплено!', 'success');
    } catch (e: any) {
      showToast(e.message || 'Не удалось купить', 'error');
    }
    setBusyId(null);
  };

  const handleEquip = async (item: ShopItem) => {
    if (!userId) return;
    setBusyId(item.id);
    try {
      const res = await authFetch('/api/shop/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, itemId: item.id }),
      });
      if (!res.ok) throw new Error();
      if (item.type === 'status') setActiveStatus(item.id);
      if (item.type === 'background') setActiveBg(item.id);
      showToast('Применено', 'success');
    } catch {
      showToast('Не удалось применить', 'error');
    }
    setBusyId(null);
  };

  const handleUnequip = async (type: 'status' | 'background') => {
    if (!userId) return;
    try {
      const res = await authFetch('/api/shop/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, itemId: null }),
      });
      if (!res.ok) throw new Error();
      if (type === 'status') setActiveStatus(null);
      if (type === 'background') setActiveBg(null);
      showToast('Снято', 'info');
    } catch {}
  };

  const filtered = items.filter((i) => i.type === tab);
  const activeId = tab === 'status' ? activeStatus : activeBg;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
        {/* Заголовок */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Магазин</h1>
              <p className="text-sm text-neutral-500">
                Трать монеты на цитаты и фоны профиля
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-semibold">
            <Coins className="w-4 h-4" />
            {coins}
          </div>
        </div>

        {/* Вкладки */}
        <div className="flex gap-2 border-b border-neutral-800">
          <button
            onClick={() => setTab('status')}
            className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px flex items-center gap-2 ${
              tab === 'status'
                ? 'text-indigo-400 border-indigo-500'
                : 'text-neutral-400 border-transparent hover:text-white'
            }`}
          >
            <Star className="w-4 h-4" />
            Цитаты
          </button>
          <button
            onClick={() => setTab('background')}
            className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px flex items-center gap-2 ${
              tab === 'background'
                ? 'text-indigo-400 border-indigo-500'
                : 'text-neutral-400 border-transparent hover:text-white'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            Фоны
          </button>
        </div>

        {!userId ? (
          <div className="text-center py-16 bg-neutral-900 border border-neutral-800 rounded-2xl">
            <Lock className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
            <p className="text-neutral-400">Войди, чтобы покупать предметы</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-neutral-900 border border-neutral-800 rounded-2xl">
            <p className="text-neutral-400">Товары появятся скоро</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => {
              const isOwned = owned.has(item.id);
              const isActive = activeId === item.id;
              const isBusy = busyId === item.id;
              const canAfford = coins >= item.price;

              return (
                <div
                  key={item.id}
                  className={`bg-neutral-900 border rounded-2xl overflow-hidden transition ${
                    isActive
                      ? 'border-indigo-500 shadow-lg shadow-indigo-500/20'
                      : 'border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  {/* Превью фона */}
                  {item.type === 'background' && (
                    <div
                      className="h-32 w-full border-b border-neutral-800"
                      style={
                        item.value?.startsWith('http')
                          ? {
                              backgroundImage: `url(${item.value})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            }
                          : { backgroundImage: item.value }
                      }
                    />
                  )}

                  {/* Превью цитаты */}
                  {item.type === 'status' && (
                    <div className="h-32 w-full bg-gradient-to-br from-indigo-950/40 via-purple-950/30 to-neutral-900 flex items-center justify-center p-4 border-b border-neutral-800">
                        <p className="text-sm text-indigo-300/90 text-center line-clamp-3 leading-snug">
                        «{item.value}»
                      </p>
                    </div>
                  )}

                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-white leading-tight">
                        {item.name}
                      </h3>
                      {isActive && (
                        <span className="flex-shrink-0 flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-indigo-400 bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" />
                          Активно
                        </span>
                      )}
                    </div>

                    {item.description && (
                      <p className="text-xs text-neutral-500">{item.description}</p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
                      <div className="flex items-center gap-1 text-yellow-400 font-semibold text-sm">
                        <Coins className="w-4 h-4" />
                        {item.price === 0 ? 'Бесплатно' : item.price}
                      </div>

                      {isOwned ? (
                        isActive ? (
                          <button
                            onClick={() => handleUnequip(item.type as 'status' | 'background')}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500/25 transition"
                          >
                            Снять
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEquip(item)}
                            disabled={isBusy}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white transition flex items-center gap-1.5"
                          >
                            {isBusy ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            Применить
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => handleBuy(item)}
                          disabled={isBusy || !canAfford}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white transition flex items-center gap-1.5"
                        >
                          {isBusy ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : null}
                          {canAfford ? 'Купить' : 'Мало монет'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}