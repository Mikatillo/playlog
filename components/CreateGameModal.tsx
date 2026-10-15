'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { mapCustomGame, type CustomGameRow } from '@/lib/custom-games';
import type { Game } from '@/types/game';

interface CreateGameModalProps {
  userId: string;
  initialTitle?: string;
  onClose: () => void;
  onCreated: (game: Game) => void;
}

const GENRES = [
  'Shooter', 'Role-playing (RPG)', 'Adventure', 'Strategy', 'Simulator', 'Sport', 'Racing',
  'Puzzle', 'Platform', 'Fighting', 'Indie', 'Arcade', 'Hack and slash/Beat \'em up',
  'Turn-based strategy (TBS)', 'Real Time Strategy (RTS)', 'Point-and-click', 'Visual Novel', 'Tactical',
];

const PLATFORMS = [
  'PC (Microsoft Windows)', 'PlayStation 5', 'PlayStation 4', 'Xbox Series X|S', 'Xbox One',
  'Nintendo Switch', 'Mac', 'Linux', 'Android', 'iOS',
];

const MAX_FILE = 5 * 1024 * 1024;

export default function CreateGameModal({ userId, initialTitle = '', onClose, onCreated }: CreateGameModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [year, setYear] = useState('');
  const [description, setDescription] = useState('');
  const [genres, setGenres] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  const pickFile = (f: File | null) => {
    setError('');
    if (!f) return;
    if (!f.type.startsWith('image/')) return setError('Нужна картинка (JPG, PNG, WebP)');
    if (f.size > MAX_FILE) return setError('Картинка больше 5 МБ');
    setFile(f);
    setCoverUrl('');
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (saving) return;
    const t = title.trim();
    if (!t) return setError('Укажи название игры');
    const y = year ? Number(year) : null;
    if (y !== null && (!Number.isInteger(y) || y < 1950 || y > 2100)) return setError('Год указан неверно');

    setSaving(true);
    setError('');
    try {
      let finalCover = coverUrl.trim() || null;
      if (file) {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('game-covers')
          .upload(path, file, { cacheControl: '31536000', contentType: file.type });
        if (upErr) throw new Error('Не удалось загрузить обложку: ' + upErr.message);
        finalCover = supabase.storage.from('game-covers').getPublicUrl(path).data.publicUrl;
      }

      const { data, error: insErr } = await supabase
        .from('custom_games')
        .insert({
          created_by: userId,
          title: t,
          cover_url: finalCover,
          year: y,
          description: description.trim() || null,
          genres,
          platforms,
        })
        .select()
        .single();
      if (insErr || !data) throw new Error(insErr?.message || 'Не удалось создать карточку');

      onCreated(mapCustomGame(data as CustomGameRow));
    } catch (e: any) {
      setError(e?.message || 'Что-то пошло не так');
      setSaving(false);
    }
  };

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-lg text-xs border transition ${
      active
        ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-200'
        : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700'
    }`;

  const shownCover = preview || coverUrl.trim() || null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-neutral-900 border border-neutral-800 sm:rounded-2xl rounded-t-2xl p-4 sm:p-6 pt-[calc(1rem+env(safe-area-inset-top))] sm:pt-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Создать карточку игры</h2>
          <button onClick={onClose} aria-label="Закрыть" className="p-2 -mr-2 text-neutral-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-neutral-400 mb-1.5">Название *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Например, Hollow Knight: Silksong"
            />
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1.5">Обложка</label>
            <div className="flex gap-3 items-start">
              <div className="relative w-32 aspect-[460/215] rounded-lg overflow-hidden bg-neutral-800 border border-neutral-700 flex-shrink-0 flex items-center justify-center">
                {shownCover ? (
                  <Image src={shownCover} alt="" fill sizes="128px" className="object-cover" unoptimized />
                ) : (
                  <ImagePlus className="w-6 h-6 text-neutral-600" />
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-neutral-800 border border-neutral-700 text-neutral-200 hover:bg-neutral-700 transition"
                >
                  Загрузить картинку
                </button>
                <input
                  value={coverUrl}
                  onChange={(e) => {
                    setCoverUrl(e.target.value);
                    setFile(null);
                    setPreview(null);
                  }}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="…или ссылка на картинку"
                />
              </div>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1.5">Лучше всего подходит горизонтальная картинка, как у Steam (460×215)</p>
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1.5">Год выхода</label>
            <input
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              className="w-28 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="2025"
            />
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1.5">Жанры</label>
            <div className="flex flex-wrap gap-1.5">
              {GENRES.map((g) => (
                <button key={g} type="button" onClick={() => toggle(genres, setGenres, g)} className={chip(genres.includes(g))}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1.5">Платформы</label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((p) => (
                <button key={p} type="button" onClick={() => toggle(platforms, setPlatforms, p)} className={chip(platforms.includes(p))}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1.5">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={4}
              className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="О чём игра (необязательно)"
            />
          </div>

          {error && <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</div>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={submit}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white font-medium rounded-lg transition text-sm"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Создаю…' : 'Создать и открыть'}
            </button>
            <button onClick={onClose} className="px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition text-sm">
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
