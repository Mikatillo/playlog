'use client';

import { useId, useState } from 'react';
import { ChevronDown, Loader2, PencilLine, Send } from 'lucide-react';

export default function ReviewComposer({ value, onChange, onPublish, minLength = 20 }: {
  value: string; onChange: (text: string) => void;
  onPublish: () => Promise<boolean | void>; minLength?: number;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState(false);
  const panelId = useId();
  async function publish() {
    if (busy || value.trim().length < minLength) return;
    setBusy(true); setError(false);
    try { if (await onPublish() !== false) { setPublished(true); setOpen(false); } }
    catch { setError(true); }
    finally { setBusy(false); }
  }
  return <section className="overflow-hidden rounded-2xl border border-neutral-700/50 bg-neutral-900/50">
    <button type="button" onClick={() => setOpen((v) => !v)} disabled={busy} aria-expanded={open} aria-controls={panelId} style={{ scale: 1 }}
      className="flex min-h-12 w-full items-center gap-2.5 p-3 text-left text-sm text-neutral-200 transition hover:bg-white/5 sm:px-4">
      <PencilLine className="pointer-events-none h-4 w-4 shrink-0 text-indigo-300" />
      <span className="flex-1 font-medium">{value.trim() ? 'Изменить отзыв' : 'Оставить отзыв'}</span>
      {published && <span className="hidden text-[10px] text-emerald-400 sm:inline">Опубликован</span>}
      <ChevronDown aria-hidden="true" className={`pointer-events-none h-4 w-4 shrink-0 text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div id={panelId} className="border-t border-neutral-800 p-3 sm:p-4">
      <textarea aria-label="Твой отзыв об игре" value={value} disabled={busy} onChange={(e) => { onChange(e.target.value); setPublished(false); }} placeholder="Что понравилось? Что запомнилось?"
        className="min-h-24 w-full resize-y rounded-xl border border-neutral-700 bg-neutral-950/60 p-3 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-indigo-400" />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] text-neutral-500">{value.trim().length} символов · минимум {minLength}</span><button type="button" onClick={() => void publish()} disabled={busy || value.trim().length < minLength} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-40">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}Опубликовать</button></div>
      {error && <p role="alert" className="mt-2 text-xs text-rose-400">Не удалось опубликовать. Текст сохранён в поле — попробуй ещё раз.</p>}
    </div>}
  </section>;
}
