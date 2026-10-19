'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { mapCustomGame, type CustomGameRow } from '@/lib/custom-games';
import { applyOverride, type OverrideRow } from '@/lib/overrides';
import type { Game } from '@/types/game';

interface CreateGameModalProps {
  userId: string;
  /** Если задано — режим редактирования существующей карточки (для админа) */
  editId?: number;
  /** Правка карточки из IGDB: правки сохраняются отдельно поверх данных IGDB (только админ) */
  baseGame?: Game;
  /** Вызывается после «Сбросить к оригиналу» */
  onReset?: () => void;
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
const MAX_SHOTS = 5;

export default function CreateGameModal({ userId, editId, baseGame, onReset, initialTitle = '', onClose, onCreated }: CreateGameModalProps) {
  const overriding = !!baseGame;
  const editing = editId !== undefined || overriding;
  const [loadingRow, setLoadingRow] = useState(editId !== undefined);
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
  const shotsRef = useRef<HTMLInputElement>(null);
  const [shots, setShots] = useState<{ file?: File; url: string }[]>([]);

  const addShots = (list: FileList | null) => {
    if (!list) return;
    setError('');
    const next = [...shots];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_SHOTS) {
        setError(`Скриншотов может быть не больше ${MAX_SHOTS}`);
        break;
      }
      if (!f.type.startsWith('image/')) {
        setError('Скриншоты должны быть картинками');
        continue;
      }
      if (f.size > MAX_FILE) {
        setError('Скриншот больше 5 МБ пропущен');
        continue;
      }
      next.push({ file: f, url: URL.createObjectURL(f) });
    }
    setShots(next);
    if (shotsRef.current) shotsRef.current.value = '';
  };
  const removeShot = (i: number) => setShots((prev) => prev.filter((_, idx) => idx !== i));

  // Режим редактирования: подгружаем карточку и заполняем форму
  useEffect(() => {
    if (!baseGame) return;
    setTitle(baseGame.title);
    setYear(baseGame.year ? String(baseGame.year) : '');
    setDescription(baseGame.description || '');
    setGenres((baseGame.genres || []).map((g) => g.name));
    setPlatforms(baseGame.platforms || []);
    setCoverUrl(baseGame.cover || '');
    setShots((baseGame.screenshots || []).map((x) => ({ url: x.image })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseGame?.id]);

  useEffect(() => {
    if (editId === undefined) return;
    let cancelled = false;
    supabase
      .from('custom_games')
      .select('*')
      .eq('id', editId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (!data) {
          setError('Не удалось загрузить карточку');
        } else {
          const r = data as CustomGameRow;
          setTitle(r.title);
          setYear(r.year ? String(r.year) : '');
          setDescription(r.description || '');
          setGenres(r.genres || []);
          setPlatforms(r.platforms || []);
          setCoverUrl(r.cover_url || '');
          setShots((r.screenshots || []).map((url) => ({ url })));
        }
        setLoadingRow(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editId]);

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  // Выбор обложки из уже добавленных скриншотов
  const makeCover = (sh: { file?: File; url: string }) => {
    setError('');
    if (sh.file) {
      setFile(sh.file);
      setPreview(sh.url);
      setCoverUrl('');
    } else {
      setFile(null);
      setPreview(null);
      setCoverUrl(sh.url);
    }
  };

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

      const shotUrls: string[] = [];
      for (let i = 0; i < shots.length; i++) {
        const f = shots[i].file;
        if (!f) {
          shotUrls.push(shots[i].url); // уже загруженный скриншот
          continue;
        }
        const ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const path = `${userId}/${Date.now()}-s${i}.${ext}`;
        const { error: shotErr } = await supabase.storage
          .from('game-covers')
          .upload(path, f, { cacheControl: '31536000', contentType: f.type });
        if (shotErr) throw new Error('Не удалось загрузить скриншот: ' + shotErr.message);
        shotUrls.push(supabase.storage.from('game-covers').getPublicUrl(path).data.publicUrl);
      }

      const fields = {
        title: t,
        cover_url: finalCover,
        year: y,
        description: description.trim() || null,
        genres,
        platforms,
        screenshots: shotUrls,
      };
      // Правка карточки из IGDB: сохраняем в game_overrides только то, что отличается от оригинала
      if (baseGame) {
        const same = (a: string[], b: string[]) => a.join('|') === b.join('|');
        const baseShots = (baseGame.screenshots || []).map((x) => x.image);
        const baseGenres = (baseGame.genres || []).map((g) => g.name);
        const row = {
          game_id: baseGame.id,
          title: t !== baseGame.title ? t : null,
          cover_url: finalCover && finalCover !== baseGame.cover ? finalCover : null,
          year: y !== null && y !== baseGame.year ? y : null,
          description: description.trim() && description.trim() !== (baseGame.description || '').trim() ? description.trim() : null,
          genres: genres.length > 0 && !same(genres, baseGenres) ? genres : null,
          platforms: platforms.length > 0 && !same(platforms, baseGame.platforms || []) ? platforms : null,
          screenshots: shotUrls.length > 0 && !same(shotUrls, baseShots) ? shotUrls : null,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        };
        const { error: ovErr } = await supabase.from('game_overrides').upsert(row, { onConflict: 'game_id' });
        if (ovErr) throw new Error(ovErr.message);
        onCreated(applyOverride(baseGame, row as OverrideRow));
        return;
      }

      const { data, error: insErr } = editing
        ? await supabase.from('custom_games').update(fields).eq('id', editId).select().single()
        : await supabase
            .from('custom_games')
            .insert({ created_by: userId, ...fields })
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
      className="fixed inset-0 z-[10001] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-neutral-900 border border-neutral-800 sm:rounded-2xl rounded-t-2xl p-4 sm:p-6 pt-[calc(1rem+env(safe-area-inset-top))] sm:pt-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">{editing ? 'Редактировать карточку' : 'Создать карточку игры'}</h2>
          <button onClick={onClose} aria-label="Закрыть" className="p-2 -mr-2 text-neutral-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loadingRow ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : (
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
            <label className="block text-xs text-neutral-400 mb-1.5">Скриншоты (до {MAX_SHOTS})</label>
            <input
              ref={shotsRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => addShots(e.target.files)}
            />
            <div className="flex flex-wrap gap-2">
              {shots.map((sh, i) => {
                const isCover = !!shownCover && shownCover === (sh.file ? preview : sh.url);
                return (
                <div
                  key={sh.url}
                  className={`group relative w-24 aspect-video rounded-lg overflow-hidden bg-neutral-800 border ${
                    isCover ? 'border-indigo-400 ring-2 ring-indigo-400/50' : 'border-neutral-700'
                  }`}
                >
                  <Image src={sh.url} alt="" fill sizes="96px" className="object-cover" unoptimized />
                  <button
                    type="button"
                    onClick={() => removeShot(i)}
                    aria-label="Убрать скриншот"
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => makeCover(sh)}
                    className={`absolute bottom-0 inset-x-0 py-0.5 text-[10px] font-medium text-center transition ${
                      isCover
                        ? 'bg-indigo-500 text-white'
                        : 'bg-black/70 text-neutral-200 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-indigo-500'
                    }`}
                  >
                    {isCover ? 'Обложка' : 'Сделать обложкой'}
                  </button>
                </div>
                );
              })}
              {shots.length < MAX_SHOTS && (
                <button
                  type="button"
                  onClick={() => shotsRef.current?.click()}
                  className="w-24 aspect-video rounded-lg border border-dashed border-neutral-600 hover:border-indigo-500/60 text-neutral-400 hover:text-white flex flex-col items-center justify-center gap-1 text-[11px] transition"
                >
                  <ImagePlus className="w-4 h-4" />
                  Загрузить скриншоты
                </button>
              )}
            </div>
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
              {saving ? 'Сохраняю…' : editing ? 'Сохранить' : 'Создать и открыть'}
            </button>
            <button onClick={onClose} className="px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition text-sm">
              Отмена
            </button>
          </div>
          {overriding && (
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                if (!baseGame || !confirm('Убрать все правки и вернуть данные из IGDB?')) return;
                setSaving(true);
                const { error: delErr } = await supabase.from('game_overrides').delete().eq('game_id', baseGame.id);
                if (delErr) {
                  setError(delErr.message);
                  setSaving(false);
                  return;
                }
                onReset?.();
              }}
              className="w-full text-xs text-neutral-500 hover:text-rose-400 transition pt-1"
            >
              Сбросить к оригиналу (IGDB)
            </button>
          )}
        </div>
        )}
      </div>
    </div>
  );
}