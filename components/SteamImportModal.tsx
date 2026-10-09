'use client';

import { authFetch } from '@/lib/api-client';
import { useState } from 'react';
import {
  X, Loader2, Gamepad2, CheckCircle, AlertCircle, Info,
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

interface SteamImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onComplete: (imported: number) => void;
}

export default function SteamImportModal({
  isOpen, onClose, userId, onComplete,
}: SteamImportModalProps) {
  const { showToast } = useToast();
  const [steamUrl, setSteamUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    notFound: number;
    totalOwned: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleImport = async () => {
    if (!steamUrl.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await authFetch('/api/steam/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, steamUrl: steamUrl.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Ошибка импорта');
        setLoading(false);
        return;
      }

      setResult({
        imported: data.imported,
        skipped: data.skipped,
        notFound: data.notFound,
        totalOwned: data.totalOwned,
      });
      showToast(`Импортировано ${data.imported} игр`, 'success');
      onComplete(data.imported);
    } catch (err: any) {
      setError(err.message || 'Сетевая ошибка');
    }
    setLoading(false);
  };

  const handleClose = () => {
    setSteamUrl('');
    setResult(null);
    setError(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4 overflow-y-auto"
      onClick={() => !loading && handleClose()}
    >
      <div
        className="bg-neutral-900 rounded-2xl max-w-lg w-full my-8 relative border border-neutral-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          disabled={loading}
          className="absolute top-4 right-4 w-8 h-8 bg-neutral-800 hover:bg-neutral-700 rounded-full flex items-center justify-center transition disabled:opacity-50 z-10"
        >
          <X className="w-4 h-4 text-neutral-400" />
        </button>

        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#1b6ca8] flex items-center justify-center">
              <img
                src="https://cdn.simpleicons.org/steam/ffffff"
                alt="Steam"
                className="w-6 h-6"
              />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Импорт из Steam</h2>
              <p className="text-sm text-neutral-400">Перенеси библиотеку в один клик</p>
            </div>
          </div>

          {!result ? (
            <>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-neutral-300 space-y-1.5">
                    <p className="font-medium text-white">Перед импортом:</p>
                    <p>Открой библиотеку в Steam:</p>
                    <p className="text-xs text-neutral-400">
                      Steam → профиль → <b>Редактировать профиль</b> → <b>Настройки приватности</b> → установи
                      <b> «Мой профиль»</b> и <b>«Детали игр»</b> = <b>Открытый</b>.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-400 mb-2 block">
                  Ссылка на Steam-профиль
                </label>
                <input
                  type="text"
                  value={steamUrl}
                  onChange={(e) => setSteamUrl(e.target.value)}
                  disabled={loading}
                  placeholder="https://steamcommunity.com/id/username"
                  className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  autoFocus
                />
                <p className="text-[11px] text-neutral-500 mt-1.5">
                  Подойдёт ссылка вида <code className="text-neutral-400">/id/username</code> или <code className="text-neutral-400">/profiles/7656...</code>. Или просто ник.
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleImport}
                disabled={loading || !steamUrl.trim()}
                className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Импортируем... (это может занять до минуты)
                  </>
                ) : (
                  <>
                    <Gamepad2 className="w-4 h-4" />
                    Импортировать библиотеку
                  </>
                )}
              </button>

              <p className="text-[11px] text-neutral-500 text-center">
                Загрузим до 50 самых «пройденных» игр (по часам). Оценки и рецензии не импортируются.
              </p>
            </>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-1">
                  Импортировано {result.imported} игр
                </h3>
                <p className="text-sm text-neutral-400">
                  Всего в Steam: {result.totalOwned}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-neutral-800 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-emerald-400">{result.imported}</div>
                  <div className="text-xs text-neutral-400">Добавлено</div>
                </div>
                <div className="bg-neutral-800 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-400">{result.skipped}</div>
                  <div className="text-xs text-neutral-400">Уже было</div>
                </div>
              </div>

              {result.notFound > 0 && (
                <p className="text-xs text-neutral-500 text-center">
                  Не найдено в базе: {result.notFound} игр
                </p>
              )}

              <button
                onClick={handleClose}
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-medium py-3 rounded-lg transition"
              >
                Отлично
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}