'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Library, Calendar, ShoppingBag, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Нижняя навигация для телефонов и планшетов (до lg).
 * На больших экранах используется навигация в шапке.
 */
export default function MobileNav() {
  const pathname = usePathname();
  const { userId } = useAuth();

  // На страницах входа/сброса пароля навигация не нужна
  if (pathname?.startsWith('/auth')) return null;

  const items = [
    { href: '/', label: 'Главная', icon: Home },
    { href: '/my-games', label: 'Мои игры', icon: Library },
    { href: '/releases', label: 'Релизы', icon: Calendar },
    { href: '/shop', label: 'Магазин', icon: ShoppingBag },
    userId
      ? { href: `/user/${userId}`, label: 'Профиль', icon: UserIcon }
      : { href: '/auth', label: 'Войти', icon: UserIcon },
  ];

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname?.startsWith(href));

  return (
    <nav
      aria-label="Основная навигация"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-neutral-900/95 backdrop-blur border-t border-neutral-800"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition ${
                  active ? 'text-indigo-400' : 'text-neutral-400 active:text-white'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="w-5 h-5" />
                <span className="truncate max-w-full px-1">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
