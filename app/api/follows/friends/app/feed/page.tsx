'use client';

import Link from 'next/link';
import { Users, UserPlus, Gamepad2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ActivityFeed from '@/components/ActivityFeed';

export default function FeedPage() {
  const { userId } = useAuth();

  if (!userId) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-10 h-10 text-neutral-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Лента активности</h1>
          <p className="text-neutral-400 mb-6">
            Войдите в аккаунт, чтобы видеть активность друзей
          </p>
          <Link
            href="/auth"
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition"
          >
            <UserPlus className="w-4 h-4" />
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
            Лента
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Активность людей, на которых вы подписаны
          </p>
        </div>

        {/* Лента активности */}
        <ActivityFeed
          userId={userId}
          scope="feed"
          showAvatars={true}
          limit={50}
          emptyText="Подпишитесь на кого-нибудь, чтобы видеть их активность"
          emptyAction={
            <Link
              href="/friends"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition text-sm mt-4"
            >
              <UserPlus className="w-4 h-4" />
              Найти друзей
            </Link>
          }
        />
      </div>
    </div>
  );
}
