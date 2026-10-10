'use client';

import PageHeading from '@/components/PageHeading';
import { authFetch } from '@/lib/api-client';
import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  UserPlus, UserMinus, Users, Loader2, User as UserIcon,
  Crown, Gamepad2, Search,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { calculateLevel } from '@/types/game';

interface FriendUser {
  id: string;
  nickname: string;
  full_name: string;
  avatar_url: string | null;
  xp: number;
  followed_at?: string;
}

type TabType = 'following' | 'followers';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} дн назад`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} мес назад`;
  return `${Math.floor(months / 12)} г назад`;
}

function UserCard({
  user,
  currentTab,
  onToggleFollow,
  followLoading,
  isCurrentUser,
  isFollowing,
}: {
  user: FriendUser;
  currentTab: TabType | 'search';
  onToggleFollow: (userId: string) => void;
  followLoading: string | null;
  isCurrentUser: boolean;
  isFollowing: boolean;
}) {
  const levelInfo = calculateLevel(user.xp);
  const isLoading = followLoading === user.id;

  return (
    <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 hover:border-neutral-700 transition-all group">
      <div className="flex items-center gap-3">
        <Link href={`/user/${user.id}`} className="flex-shrink-0">
          <div className="relative w-12 h-12 md:w-14 md:h-14 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-500">
            {user.avatar_url ? (
              <Image src={user.avatar_url} alt={user.nickname} fill sizes="56px" className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">
                {user.nickname.substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        </Link>

        <div className="flex-1 min-w-0">
          <Link href={`/user/${user.id}`} className="font-semibold text-white hover:text-indigo-400 transition truncate block">
            {user.nickname}
          </Link>
          {user.full_name && <p className="text-xs text-neutral-400 truncate">{user.full_name}</p>}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-neutral-500 flex items-center gap-1">
              <Crown className="w-3 h-3 text-yellow-500" />
              Уровень {levelInfo.level}
            </span>
            {user.followed_at && <span className="text-xs text-neutral-600">· {timeAgo(user.followed_at)}</span>}
          </div>
        </div>

        {!isCurrentUser && (
          <button
            onClick={() => onToggleFollow(user.id)}
            disabled={isLoading}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
              currentTab === 'following' || isFollowing
                ? 'bg-neutral-800 hover:bg-red-500/20 hover:border-red-500/30 border border-neutral-700 text-neutral-300 hover:text-red-400'
                : 'bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400'
            } disabled:opacity-50`}
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : currentTab === 'following' || isFollowing ? (
              <>
                <UserMinus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Отписаться</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Подписаться</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function FriendsPageContent() {
  const { userId } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<TabType>(
    (searchParams.get('tab') as TabType) || 'following'
  );
  const [users, setUsers] = useState<FriendUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set<string>());
  const [followersCount, setFollowersCount] = useState<number | null>(null);
  const [followingLoaded, setFollowingLoaded] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    localStorage.setItem('playlog:last_friends_visit', new Date().toISOString());
  }, []);

  const loadUsers = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/follows/list?user_id=${userId}&type=${activeTab}`);
      if (res.ok) {
        const data = await res.json();
        const list: FriendUser[] = data.users || [];
        setUsers(list);
        if (activeTab === 'followers') setFollowersCount(list.length);
      }
    } catch (err) {
      console.error('Load friends error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, activeTab]);

  const loadFollowing = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/follows/list?user_id=${userId}&type=following`);
      if (res.ok) {
        const data = await res.json();
        const ids = new Set<string>((data.users || []).map((u: FriendUser) => u.id));
        setFollowingIds(ids);
        setFollowingLoaded(true);
      }
    } catch (err) {
      console.error('Load following error:', err);
    }
  }, [userId]);

  // Количество подписчиков нужно знать всегда, даже когда открыта вкладка «Подписки»
  const loadFollowersCount = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/follows?user_id=${userId}&target_id=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setFollowersCount(data.count || 0);
      }
    } catch (err) {
      console.error('Load followers count error:', err);
    }
  }, [userId]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadFollowing();
    loadFollowersCount();
  }, [loadFollowing, loadFollowersCount]);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.users || []);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleToggleFollow = async (targetId: string) => {
    if (!userId) {
      showToast('Войдите, чтобы управлять подписками', 'info');
      return;
    }

    setFollowLoading(targetId);
    try {
      const res = await authFetch('/api/follows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, targetId }),
      });

      if (res.ok) {
        const data = await res.json();

        if (data.action === 'unfollowed') {
          setUsers((prev) => prev.filter((u) => u.id !== targetId));
          setFollowingIds((prev) => {
            const next = new Set<string>(prev);
            next.delete(targetId);
            return next;
          });
          showToast('Вы отписались', 'info');
        } else if (data.action === 'followed') {
          showToast('Вы подписались!', 'success');
          setFollowingIds((prev) => new Set<string>([...prev, targetId]));
          loadUsers();
        }
      }
    } catch (err) {
      showToast('Не удалось выполнить действие', 'error');
    } finally {
      setFollowLoading(null);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchQuery('');
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    router.push(url.pathname + '?' + url.searchParams.toString(), { scroll: false });
  };

  if (!userId) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-10 h-10 text-neutral-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Друзья</h1>
          <p className="text-neutral-400 mb-6">Войдите в аккаунт, чтобы видеть подписки и подписчиков</p>
          <Link href="/auth" className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition">
            <UserIcon className="w-4 h-4" />
            Войти
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
        <PageHeading
          icon={Users}
          title="Друзья"
          subtitle="Управляй подписками и следи за активностью друзей"
          accent="fuchsia"
        />

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Найти пользователей по нику..."
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 animate-spin" />
          )}
        </div>

        {searchQuery && searchQuery.length >= 2 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-neutral-400 mb-3">Результаты поиска:</h3>
            {searching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-8 bg-neutral-900 rounded-xl border border-neutral-800">
                <Search className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                <p className="text-sm text-neutral-400">Ничего не найдено</p>
              </div>
            ) : (
              <div className="space-y-2">
                {searchResults.map((user) => (
                  <UserCard
                    key={user.id}
                    user={user}
                    currentTab="search"
                    onToggleFollow={handleToggleFollow}
                    followLoading={followLoading}
                    isCurrentUser={user.id === userId}
                    isFollowing={followingIds.has(user.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {!searchQuery && (
          <>
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => handleTabChange('following')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition ${
                  activeTab === 'following'
                    ? 'bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30'
                    : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                Подписки
                {followingLoaded && (
                  <span className={`px-1.5 py-0.5 rounded text-xs ${activeTab === 'following' ? 'bg-indigo-500/20' : 'bg-neutral-800'}`}>
                    {followingIds.size}
                  </span>
                )}
              </button>
              <button
                onClick={() => handleTabChange('followers')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition ${
                  activeTab === 'followers'
                    ? 'bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30'
                    : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800'
                }`}
              >
                <Users className="w-4 h-4" />
                Подписчики
                {followersCount !== null && (
                  <span className={`px-1.5 py-0.5 rounded text-xs ${activeTab === 'followers' ? 'bg-indigo-500/20' : 'bg-neutral-800'}`}>
                    {followersCount}
                  </span>
                )}
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <span className="ml-3 text-neutral-400">Загрузка...</span>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-16 bg-neutral-900 rounded-xl border border-neutral-800">
                <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-neutral-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {activeTab === 'following' ? 'Вы ни на кого не подписаны' : 'У вас пока нет подписчиков'}
                </h3>
                <p className="text-sm text-neutral-400 mb-6 max-w-sm mx-auto">
                  {activeTab === 'following'
                    ? 'Найдите интересных игроков и подпишитесь, чтобы видеть их активность'
                    : 'Поделитесь ссылкой на профиль, чтобы друзья могли подписаться'}
                </p>
                <Link href="/" className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition text-sm">
                  <Gamepad2 className="w-4 h-4" />
                  Найти игроков
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((user) => (
                  <UserCard
                    key={user.id}
                    user={user}
                    currentTab={activeTab}
                    onToggleFollow={handleToggleFollow}
                    followLoading={followLoading}
                    isCurrentUser={user.id === userId}
                    isFollowing={followingIds.has(user.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function FriendsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    }>
      <FriendsPageContent />
    </Suspense>
  );
}