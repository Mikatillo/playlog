'use client';

import { useState, useEffect } from 'react';
import { Loader2, Lock, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let done = false;

    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      setValid(ok);
      setChecking(false);
    };

    // Supabase сам разбирает токен из hash (#access_token=...&type=recovery)
    // или из query (?code=...), и шлёт событие PASSWORD_RECOVERY / SIGNED_IN
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN')) {
        finish(true);
      }
    });

    const init = async () => {
      // 1. Уже есть сессия? Значит ссылка валидна.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) return finish(true);

      // 2. В URL есть признаки recovery-ссылки?
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      const hasToken =
        hash.includes('access_token') ||
        hash.includes('type=recovery') ||
        search.includes('code=');

      if (!hasToken) return finish(false);

      // 3. Даём библиотеке время обработать ссылку (обменять code/hash на сессию)
      setTimeout(async () => {
        const { data: { session: s2 } } = await supabase.auth.getSession();
        finish(!!s2);
      }, 2500);
    };

    init();

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return setError('Пароль должен быть минимум 6 символов');
    if (password !== confirm) return setError('Пароли не совпадают');
    setLoading(true);
    setError(null);

    const { error: supaError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (supaError) {
      setError(supaError.message);
      showToast('Не удалось обновить пароль', 'error');
      return;
    }

    showToast('Пароль изменён', 'success');
    router.push('/');
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Ссылка недействительна</h1>
          <p className="text-sm text-neutral-400 mb-6">
            Возможно, она устарела или уже использовалась. Запроси новую.
          </p>
          <Link
            href="/auth/forgot-password"
            className="inline-block px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition"
          >
            Запросить новую ссылку
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Новый пароль</h1>
            <p className="text-sm text-neutral-400">Придумай новый пароль</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-neutral-400 mb-2 block">
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
              className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Минимум 6 символов"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-neutral-400 mb-2 block">
              Повтори пароль
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Ещё раз"
            />
          </div>

          {error && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password || !confirm}
            className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Сохраняем...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Сохранить пароль
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}