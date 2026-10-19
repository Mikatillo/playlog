'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Check, ChevronDown, Loader2, UserPlus, Users, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

interface Friend {
  id: string;
  nickname: string;
  avatar_url: string | null;
}

interface GameMetaProps {
  gameId: number;
  platforms: string[];
  /** Чьих тиммейтов показывать (по умолчанию — свои). На чужом профиле список только для чтения */
  ownerId?: string;
}

const VISIBLE_PLATFORMS = 2;
const MAX_TEAMMATES = 5;

function Avatar({ friend, size = 24 }: { friend: Friend; size?: number }) {
  return (
    <span
      className="relative inline-flex items-center justify-center rounded-full bg-neutral-700 text-[10px] font-bold text-neutral-200 overflow-hidden flex-shrink-0 ring-2 ring-neutral-900"
      style={{ width: size, height: size }}
    >
      {friend.avatar_url ? (
        <Image src={friend.avatar_url} alt="" fill sizes={`${size}px`} className="object-cover" unoptimized />
      ) : (
        (friend.nickname || '?').slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

export default function GameMeta({ gameId, platforms, ownerId }: GameMetaProps) {
  const { userId } = useAuth();
  const owner = ownerId || userId;
  const canEdit = !!userId && owner === userId;
  const { showToast } = useToast();

  const [platformsOpen, setPlatformsOpen] = useState(false);
  const [teammates, setTeammates] = useState<Friend[]>([]);
  const [following, setFollowing] = useState<Friend[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Новая игра → всё сворачиваем и грузим тиммейтов заново
  useEffect(() => {
    setPlatformsOpen(false);
    setPickerOpen(false);
    setTeammates([]);
    if (!owner) return;
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from('game_teammates')
        .select('teammate_id')
        .eq('user_id', owner)
        .eq('game_id', gameId);
      const ids = (rows || []).map((r: any) => r.teammate_id as string);
      if (ids.length === 0 || cancelled) return;
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, nickname, avatar_url')
        .in('id', ids);
      if (!cancelled) setTeammates((profs || []) as Friend[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId, owner]);

  const openPicker = async () => {
    const next = !pickerOpen;
    setPickerOpen(next);
    if (next && following === null && userId) {
      setLoadingFriends(true);
      try {
        const res = await fetch(`/api/follows/list?user_id=${userId}&type=following`);
        const data = await res.json();
        setFollowing(
          (data.users || []).map((u: any) => ({
            id: u.id,
            nickname: u.nickname || u.full_name || 'Игрок',
            avatar_url: u.avatar_url || null,
          })),
        );
      } catch {
        setFollowing([]);
      }
      setLoadingFriends(false);
    }
  };

  const toggle = async (friend: Friend) => {
    if (!userId) return;
    const has = teammates.some((t) => t.id === friend.id);
    if (!has && teammates.length >= MAX_TEAMMATES) {
      showToast(`Не больше ${MAX_TEAMMATES} тиммейтов`, 'info');
      return;
    }
    setBusyId(friend.id);
    try {
      if (has) {
        const { error } = await supabase
          .from('game_teammates')
          .delete()
          .eq('user_id', userId)
          .eq('game_id', gameId)
          .eq('teammate_id', friend.id);
        if (error) throw error;
        setTeammates((prev) => prev.filter((t) => t.id !== friend.id));
      } else {
        const { error } = await supabase
          .from('game_teammates')
          .insert({ user_id: userId, game_id: gameId, teammate_id: friend.id });
        if (error && error.code !== '23505') throw error;
        setTeammates((prev) => [...prev, friend]);
      }
      setPickerOpen(false);
    } catch {
      showToast('Не удалось сохранить тиммейта', 'error');
    }
    setBusyId(null);
  };

  const shownPlatforms = platformsOpen ? platforms : platforms.slice(0, VISIBLE_PLATFORMS);
  const hiddenCount = platforms.length - VISIBLE_PLATFORMS;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        {/* Платформы: 2 сразу, остальные по кнопке */}
        {platforms.length > 0 && (
          <div className="min-w-0">
            <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Платформы</h3>
            <div className="flex gap-1.5 flex-wrap items-center">
              {shownPlatforms.map((platform) => (
                <div key={platform} className="px-2.5 py-1 bg-neutral-800 rounded-lg text-xs text-neutral-300">
                  {platform}
                </div>
              ))}
              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => setPlatformsOpen((v) => !v)}
                  aria-expanded={platformsOpen}
                  className="px-2.5 py-1 rounded-lg text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/25 hover:bg-indigo-500/20 transition inline-flex items-center gap-1"
                >
                  {platformsOpen ? 'Скрыть' : `+${hiddenCount}`}
                  <ChevronDown className={`w-3 h-3 transition-transform ${platformsOpen ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Тиммейты */}
        {(canEdit || teammates.length > 0) && (
          <div className="min-w-0">
            <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Проходил с</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {teammates.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {teammates.map((t) => (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1.5 pl-1 pr-1.5 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-xs text-neutral-200"
                    >
                      <Link
                        href={`/user/${t.id}`}
                        title={`Профиль ${t.nickname}`}
                        className="inline-flex items-center gap-1.5 hover:text-white hover:underline underline-offset-2 transition"
                      >
                        <Avatar friend={t} size={20} />
                        <span className="max-w-[90px] truncate">{t.nickname}</span>
                      </Link>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => toggle(t)}
                          aria-label={`Убрать ${t.nickname}`}
                          className="text-neutral-500 hover:text-rose-400 transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
              {canEdit && (
              <button
                type="button"
                onClick={openPicker}
                aria-expanded={pickerOpen}
                className="px-2.5 py-1 rounded-lg text-xs text-neutral-300 bg-neutral-800 border border-dashed border-neutral-600 hover:border-indigo-500/60 hover:text-white transition inline-flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {teammates.length === 0 ? 'Тиммейт' : 'Ещё'}
              </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Список подписок: раскрывается под строкой */}
      {canEdit && pickerOpen && (
        <div className="rounded-xl bg-neutral-800/70 border border-neutral-700 p-2">
          {loadingFriends ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
            </div>
          ) : !following || following.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-neutral-400 px-2 py-3">
              <Users className="w-4 h-4 flex-shrink-0" />
              Тиммейтов можно выбрать из подписок — подпишись на друзей, и они появятся здесь.
            </div>
          ) : (
            <ul className="max-h-44 overflow-y-auto space-y-0.5">
              {following.map((f) => {
                const selected = teammates.some((t) => t.id === f.id);
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => toggle(f)}
                      disabled={!!busyId}
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left text-sm transition ${
                        selected ? 'bg-indigo-500/15 text-white' : 'text-neutral-300 hover:bg-neutral-700/60'
                      }`}
                    >
                      <Avatar friend={f} size={26} />
                      <span className="flex-1 truncate">{f.nickname}</span>
                      {busyId === f.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-400" />
                      ) : selected ? (
                        <Check className="w-4 h-4 text-indigo-400" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
