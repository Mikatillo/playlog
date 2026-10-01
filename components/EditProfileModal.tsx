'use client';

import { useState } from 'react';
import { X, User, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentNickname: string;
  userId: string;
  onSaved: (newNickname: string) => void;
}

export default function EditProfileModal({
  isOpen,
  onClose,
  currentNickname,
  userId,
  onSaved,
}: EditProfileModalProps) {
  const [nickname, setNickname] = useState(currentNickname);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    const trimmed = nickname.trim();
    if (trimmed.length < 2) {
      setError('Ник должен быть не короче 2 символов');
      return;
    }
    if (trimmed.length > 30) {
      setError('Ник должен быть не длиннее 30 символов');
      return;
    }
    setSaving(true);
    setError(null);

    const { error: supaError } = await supabase
      .from('profiles')
      .update({ nickname: trimmed })
      .eq('id', userId);

    setSaving(false);
    if (supaError) {
      setError('Не удалось сохранить: ' + supaError.message);
      return;
    }
    onSaved(trimmed);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 rounded-2xl max-w-md w-full p-6 relative border border-neutral-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 bg-neutral-800 hover:bg-neutral-700 rounded-full flex items-center justify-center transition"
        >
          <X className="w-4 h-4 text-neutral-400" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center">
            <User className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Редактировать профиль</h2>
            <p className="text-sm text-neutral-400">Измени своё отображаемое имя</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-neutral-400 mb-2 block">
              Никнейм
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={30}
              autoFocus
              className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Твой ник"
            />
            <div className="mt-1 text-right">
              <span className="text-xs text-neutral-500">{nickname.length} / 30</span>
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Сохраняем...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Сохранить
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={saving}
              className="px-6 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium py-3 rounded-lg transition disabled:opacity-50"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}