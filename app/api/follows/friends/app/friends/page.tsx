'use client';

import { useEffect, useState, useCallback } from 'react';
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
}: {
  user: FriendUser;
  currentTab: TabType;
  onToggleFollow: (userId: string) => void;
  followLoading: string | null;
  isCurrentUser: boolean;
}) {
  const levelInfo = calculateLevel(user.xp);
  const isLoading = followLoading === user.id;

  return (
    <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 hover:border-neutral-700 transition-all group">
      <div className="flex items-center gap-3">
        {/* Аватар */}
        <Link href={`/user/${user.id}`} className="flex-shrink-0">
          <div className="relative w-12 h-12 md:w-14 md:h-14 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-500">
            {user.avatar_url ? (
              <Image
                src={user.avatar_url}
                alt={user.nickname}
                fill
                sizes="56px"
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">
                {user.nickname.substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        </Link>

        {/* Информация */}
        <div className="flex-1 min-w-0">
          <Link
            href={`/user/${user.id}`}
            className="font-semibold text-white hover:text-indigo-400 transition truncate block"
          >
            {user.nickname}
          </Link>
          {user.full_name && (
            <p className="text-xs text-neutral-400 truncate">{user.full_name}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-neutral-500 flex items-center gap-1">
              <Crown className="w-3 h-3 text-yellow-500" />
              Уровень {levelInfo.level}
            </span>
            {user.followed_at && (
              <span className="text-xs text-neutral-600">
                · {timeAgo(user.followed_at)}
              </span>
            )}
          </div>
        </div>

        {/* Кнопка действия */}
        {!isCurrentUser && (
          <button
            onClick={() => onToggleFollow(user.id)}
            disabled={isLoading}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
              currentTab === 'following'
                ? 'bg-neutral-800 hover:bg-red-500/20 hover:border-red-500/30 border border-neutral-700 text-neutral-300 hover:text-red-400'
                : 'bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400'
            } disabled:opacity-50`}
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : currentTab === 'following' ? (
              <>
                <UserMinus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Отписаться</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">В ответ</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default function FriendsPage() {
  const { userId } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<TabType>(
    (searchParams.get('tab') as TabType) || 'following',
  );
  const [users, setUsers] = useState<FriendUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadUsers = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/follows/list?user_id=${userId}&type=${activeTab}`,
      );
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Load friends error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, activeTab]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleToggleFollow = async (targetId: string) => {
    if (!userId) {
      showToast('Войдите, чтобы управлять подписками', 'info');
      return;
    }

    setFollowLoading(targetId);
    try {
      const res = await fetch('/api/follows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, targetId }),
      });

      if (res.ok) {
        const data = await res.json();

        if (activeTab === 'following' && data.action === 'unfollowed') {
          // Убираем из списка
          setUsers((prev) => prev.filter((u) => u.id !== targetId));
          showToast('Вы отписались', 'info');
        } else if (activeTab === 'followers' && data.action === 'followed') {
          showToast('Вы подписались в ответ!', 'success');
          // Можно добавить в список following, но проще перезагрузить
          loadUsers();
        }
      }
    } catch (err) {
      showToast('Не удалось выполнить действие', 'error');
    } finally {
      setFollowLoading(null);
    }
  };

  const filteredUsers = searchQuery
    ? users.filter(
        (u) =>
          u.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.full_name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : users;

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchQuery('');
    // Обновляем URL
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
          <p className="text-neutral-400 mb-6">
            Войдите в аккаунт, чтобы видеть подписки и подписчиков
          </p>
          <Link
            href="/auth"
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition"
          >
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
        {/* Заголовок */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-indigo-500" />
            Друзья
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Управляй подписками и следи за активностью друзей
          </p>
        </div>

        {/* Табы */}
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
            {!loading && (
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeTab === 'following' ? 'bg-indigo-500/20' : 'bg-neutral-800'
              }`}>
                {users.length}
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
            {!loading && (
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeTab === 'followers' ? 'bg-indigo-500/20' : 'bg-neutral-800'
              }`}>
                {users.length}
              </span>
            )}
          </button>
        </div>

        {/* Поиск */}
        {users.length > 3 && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Найти в списке..."
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>
        )}

        {/* Контент */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <span className="ml-3 text-neutral-400">Загрузка...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-16 bg-neutral-900 rounded-xl border border-neutral-800">
            <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
              {searchQuery ? (
                <Search className="w-8 h-8 text-neutral-500" />
              ) : (
                <Users className="w-8 h-8 text-neutral-500" />
              )}
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {searchQuery
                ? 'Ничего не найдено'
                : activeTab === 'following'
                  ? 'Вы ни на кого не подписаны'
                  : 'У вас пока нет подписчиков'}
            </h3>
            <p className="text-sm text-neutral-400 mb-6 max-w-sm mx-auto">
              {searchQuery
                ? 'Попробуйте изменить запрос'
                : activeTab === 'following'
                  ? 'Найдите интересных игроков и подпишитесь, чтобы видеть их активность'
                  : 'Поделитесь ссылкой на профиль, чтобы друзья могли подписаться'}
            </p>
            {!searchQuery && (
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition text-sm"
              >
                <Gamepad2 className="w-4 h-4" />
                Найти игроков
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredUsers.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                currentTab={activeTab}
                onToggleFollow={handleToggleFollow}
                followLoading={followLoading}
                isCurrentUser={user.id === userId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
