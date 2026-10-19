'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import ProfileDialog from './ProfileDialog';

export default function ShareButton({ path, title, className = '', compact = false }: {
  path: string; title: string; className?: string; compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [busy, setBusy] = useState(false);
  async function share() {
    if (busy) return;
    setBusy(true); setCopied(false); setManualUrl('');
    const url = new URL(path, window.location.origin).href;
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); setCopied(true); return; }
      setManualUrl(url);
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) setManualUrl(url);
    } finally { setBusy(false); }
  }
  return <div className="relative inline-flex min-w-0">
    <button type="button" onClick={share} disabled={busy} title={copied ? 'Ссылка скопирована' : 'Поделиться'} aria-label={copied ? 'Ссылка скопирована' : `Поделиться: ${title}`}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-neutral-700/70 bg-neutral-800/60 px-3 py-2 text-xs font-medium text-neutral-300 transition hover:border-indigo-400/50 hover:text-white disabled:opacity-50 ${className}`}>
      {copied ? <Check className="pointer-events-none h-3.5 w-3.5 text-emerald-300" /> : <Share2 className="pointer-events-none h-3.5 w-3.5" />}
      <span className={compact ? 'hidden sm:inline' : ''}>{copied ? 'Скопировано' : 'Поделиться'}</span>
    </button>
    <span className="sr-only" role="status">{copied ? 'Ссылка скопирована' : ''}</span>
    <ProfileDialog open={!!manualUrl} title="Поделиться ссылкой" onClose={() => setManualUrl('')}>
      <label className="block text-sm text-neutral-400">Скопируй ссылку
        <input aria-label="Ссылка для копирования" readOnly value={manualUrl} onFocus={(e) => e.currentTarget.select()} onClick={(e) => e.currentTarget.select()} className="mt-3 w-full rounded-xl border border-neutral-700 bg-neutral-950 p-3 text-sm text-white" />
      </label>
    </ProfileDialog>
  </div>;
}
