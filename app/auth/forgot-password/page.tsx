'use client';

import { useState } from 'react';
import { ArrowLeft, Loader2, Mail, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';

export default function ForgotPasswordPage() {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Неверный формат email');
      return;
    }
    setLoading(true);
    setError(null);

    const { error: supaError } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    setLoading(false);
    if (supaError) {
      setError(supaError.message);
      showToast('Не удалось отправить письмо', 'error');
      return;
    }
    setSent(true);
    showToast('Письмо отправлено', 'success');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          href="/auth"
          className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад ко входу
        </Link>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 shadow-2xl">
          {sent ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Письмо отправлено</h1>
              <p className="text-sm text-neutral-400 mb-6">
                Мы отправили ссылку для сброса пароля на <br />
                <span className="text-white font-medium">{email}</span>
              </p>
              <p className="text-xs text-neutral-500 mb-6">
                Проверь папку «Спам», если письмо не пришло в течение пары минут.
              </p>
              <Link
                href="/auth"
                className="inline-block px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition"
              >
                Вернуться ко входу
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Забыли пароль?</h1>
                  <p className="text-sm text-neutral-400">
                    Введи email — пришлём ссылку для сброса
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-neutral-400 mb-2 block">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                    required
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="you@example.com"
                  />
                </div>

                {error && (
                  <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Отправляем...
                    </>
                  ) : (
                    'Отправить ссылку'
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}