'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Gamepad2, Mail, Lock, User, ArrowRight } from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        // Вход
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
      } else {
        // Регистрация
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              nickname: nickname,
            },
          },
        });

        if (error) throw error;
      }

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f1e] flex items-center justify-center p-4">
      <div className="retro-grid absolute inset-0"></div>
      
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-[#1a1a2e] border-4 border-[#b142f5] p-8">
          {/* Логотип */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-[#b142f5] flex items-center justify-center">
              <Gamepad2 className="w-7 h-7 text-[#ffec27]" />
            </div>
            <div className="font-pixel text-lg">
              <span className="text-[#ff004d]">PLAY</span>
              <span className="text-[#00e436]">LOG</span>
            </div>
          </div>

          {/* Заголовок */}
          <h1 className="font-pixel text-xl text-[#ffec27] text-center mb-6">
            {isLogin ? 'ВХОД' : 'РЕГИСТРАЦИЯ'}
          </h1>

          {/* Форма */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="font-pixel text-[10px] text-[#747474] mb-2 block">НИКНЕЙМ</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#747474]" />
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Введи никнейм"
                    className="w-full bg-[#0f0f1e] border-2 border-[#747474] py-3 pl-10 pr-4 font-pixel text-xs text-[#fcfcfc] focus:outline-none focus:border-[#b142f5]"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="font-pixel text-[10px] text-[#747474] mb-2 block">EMAIL</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#747474]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Введи email"
                  className="w-full bg-[#0f0f1e] border-2 border-[#747474] py-3 pl-10 pr-4 font-pixel text-xs text-[#fcfcfc] focus:outline-none focus:border-[#b142f5]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="font-pixel text-[10px] text-[#747474] mb-2 block">ПАРОЛЬ</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#747474]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Введи пароль (мин. 6 символов)"
                  className="w-full bg-[#0f0f1e] border-2 border-[#747474] py-3 pl-10 pr-4 font-pixel text-xs text-[#fcfcfc] focus:outline-none focus:border-[#b142f5]"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {error && (
              <div className="bg-[#ff004d]/20 border-2 border-[#ff004d] p-3 font-pixel text-[10px] text-[#ff004d]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00e436] text-[#0f0f1e] font-pixel text-xs py-3 hover:bg-[#00ff40] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'ЗАГРУЗКА...' : isLogin ? 'ВОЙТИ' : 'СОЗДАТЬ АККАУНТ'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Переключатель */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="font-pixel text-[10px] text-[#29adff] hover:text-[#ffec27]"
            >
              {isLogin ? 'НЕТ АККАУНТА? ЗАРЕГИСТРИРУЙСЯ' : 'УЖЕ ЕСТЬ АККАУНТ? ВОЙДИ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}