'use client';

import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

const DISMISS_KEY = 'playlog:install-dismissed';
const DISMISS_DAYS = 14;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}

/**
 * Регистрирует service worker и показывает на телефоне подсказку «Установить приложение».
 * Android/Chrome — кнопка установки, iPhone/Safari — инструкция «Поделиться → На экран Домой».
 */
export default function PwaSetup() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    // Service worker — только на боевом сайте, чтобы не мешать разработке
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    if (isStandalone()) return;

    try {
      const ts = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (ts && Date.now() - ts < DISMISS_DAYS * 24 * 3600 * 1000) return;
    } catch {}

    const isMobile = window.matchMedia('(max-width: 1023px)').matches;
    if (!isMobile) return;

    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream;

    if (ios) {
      // Safari не умеет показывать окно установки — объясняем вручную (через паузу, не сразу)
      const t = setTimeout(() => {
        setShowIos(true);
        setHidden(false);
      }, 4000);
      return () => clearTimeout(t);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => null);
    setDeferred(null);
    setHidden(true);
  };

  if (hidden || (!deferred && !showIos)) return null;

  return (
    <div
      className="lg:hidden fixed inset-x-3 z-50 rounded-2xl border border-indigo-500/30 bg-neutral-900/95 backdrop-blur shadow-2xl shadow-black/50 p-3 flex items-center gap-3"
      style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
      role="dialog"
      aria-label="Установить приложение"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" className="w-11 h-11 rounded-xl flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-white leading-tight">Установить PlayLog</div>
        {showIos ? (
          <div className="text-xs text-neutral-400 mt-0.5 leading-snug">
            Нажми <Share className="inline w-3.5 h-3.5 -mt-0.5 text-sky-400" /> «Поделиться», затем
            «На экран “Домой”»
          </div>
        ) : (
          <div className="text-xs text-neutral-400 mt-0.5">Иконка на рабочем столе, как у приложения</div>
        )}
      </div>
      {!showIos && (
        <button
          type="button"
          onClick={install}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold flex-shrink-0 transition"
        >
          <Download className="w-3.5 h-3.5" />
          Установить
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Закрыть"
        className="p-1.5 text-neutral-500 hover:text-white flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
