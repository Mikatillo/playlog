'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X, User, Save, Loader2, Lock, Mail, Camera, Trash2,
  MapPin, Link2, AtSign,
} from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { UserProfile } from '@/types/game';

type Tab = 'profile' | 'security';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  userId: string;
  userEmail?: string;
  onUpdate: (updated: Partial<UserProfile>) => void;
}

// Определяем MIME по расширению — если браузер не отдал file.type
function getMimeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'avif':
      return 'image/avif';
    default:
      return 'image/jpeg';
  }
}

// Upload с retry — 3 попытки
async function uploadWithRetry(
  bucket: string,
  path: string,
  file: File,
  retries = 3,
): Promise<{ publicUrl: string; error: any }> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          upsert: true,
          cacheControl: '3600',
          contentType: file.type || getMimeFromName(file.name),
        });

      if (error) {
        lastError = error;
        console.warn(`Upload attempt ${attempt} failed:`, error.message);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
          continue;
        }
      } else {
        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
        return { publicUrl, error: null };
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`Upload attempt ${attempt} threw:`, err.message);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }
  return { publicUrl: '', error: lastError };
}

export default function EditProfileModal({
  isOpen, onClose, profile, userId, userEmail, onUpdate,
}: EditProfileModalProps) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('profile');

  const [nickname, setNickname] = useState(profile.nickname);
  const [fullName, setFullName] = useState('');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [steamUrl, setSteamUrl] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(profile.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newEmail, setNewEmail] = useState(userEmail || '');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !uploading && !savingProfile && !savingEmail && !savingPassword) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, uploading, savingProfile, savingEmail, savingPassword, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setTab('profile');
    setNickname(profile.nickname);
    setAvatarUrl(profile.avatarUrl);
    setNewEmail(userEmail || '');
    setNewPassword('');
    setConfirmPassword('');
    setProfileError(null);
    setEmailError(null);
    setPasswordError(null);

    supabase
      .from('profiles')
      .select('full_name, region, city, steam_url')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setFullName(data.full_name || '');
          setRegion(data.region || '');
          setCity(data.city || '');
          setSteamUrl(data.steam_url || '');
        }
      });
  }, [isOpen, profile.nickname, profile.avatarUrl, userEmail, userId]);

  if (!isOpen) return null;

  const isBusy = uploading || savingProfile || savingEmail || savingPassword;

  // ========== АВАТАР ==========
  const handleAvatarSelect = async (file: File) => {
    if (!file.type.startsWith('image/') && !getMimeFromName(file.name).startsWith('image/')) {
      return setProfileError('Только изображения');
    }
    if (file.size > 5 * 1024 * 1024) return setProfileError('Максимум 5 МБ');

    setUploading(true);
    setProfileError(null);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${userId}/avatar.${ext}`;

      const { publicUrl, error: upErr } = await uploadWithRetry('avatars', path, file);

      if (upErr) {
        console.error('Avatar upload error:', upErr);
        throw new Error(upErr.message || 'Не удалось загрузить');
      }

      const url = `${publicUrl}?t=${Date.now()}`;

      const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId);
      if (dbErr) throw dbErr;

      setAvatarUrl(url);
      onUpdate({ avatarUrl: url });
      showToast('Аватар обновлён', 'success');
    } catch (err: any) {
      console.error('handleAvatarSelect error:', err);
      setProfileError(err.message || 'Ошибка загрузки');
      showToast('Ошибка загрузки аватара', 'error');
    }
    setUploading(false);
  };

  const handleAvatarDelete = async () => {
    if (!avatarUrl) return;
    if (!confirm('Удалить аватар?')) return;
    setUploading(true);
    try {
      const { data: files } = await supabase.storage.from('avatars').list(userId);
      const avatarFiles = (files || []).filter((f) => f.name.startsWith('avatar.'));
      if (avatarFiles.length) {
        await supabase.storage.from('avatars').remove(avatarFiles.map((f) => `${userId}/${f.name}`));
      }
      await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId);
      setAvatarUrl(undefined);
      onUpdate({ avatarUrl: undefined });
      showToast('Аватар удалён', 'info');
    } catch {}
    setUploading(false);
  };

  // ========== ПРОФИЛЬ ==========
  const handleSaveProfile = async () => {
    const trimmed = nickname.trim();
    if (trimmed.length < 2) return setProfileError('Ник минимум 2 символа');
    if (trimmed.length > 30) return setProfileError('Ник максимум 30 символов');

    let steamToSave = steamUrl.trim();
    if (steamToSave && !steamToSave.startsWith('http')) {
      steamToSave = `https://${steamToSave}`;
    }
    if (steamToSave && !steamToSave.includes('steamcommunity.com') && !steamToSave.includes('steampowered.com')) {
      return setProfileError('Ссылка должна вести на steamcommunity.com');
    }

    setSavingProfile(true);
    setProfileError(null);
    const { error } = await supabase
      .from('profiles')
      .update({
        nickname: trimmed,
        full_name: fullName.trim() || null,
        region: region.trim() || null,
        city: city.trim() || null,
        steam_url: steamToSave || null,
      })
      .eq('id', userId);

    setSavingProfile(false);
    if (error) {
      setProfileError(error.message);
      showToast('Не удалось сохранить', 'error');
      return;
    }
    onUpdate({ nickname: trimmed });
    showToast('Профиль обновлён', 'success');
    onClose();
  };

  const handleSaveEmail = async () => {
    const t = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return setEmailError('Неверный email');
    if (t === userEmail?.toLowerCase()) return setEmailError('Это твой текущий email');
    setSavingEmail(true);
    setEmailError(null);
    const { error } = await supabase.auth.updateUser({ email: t });
    setSavingEmail(false);
    if (error) return setEmailError(error.message);
    showToast('Проверь новый email', 'success');
  };

  const handleSavePassword = async () => {
    if (newPassword.length < 6) return setPasswordError('Минимум 6 символов');
    if (newPassword !== confirmPassword) return setPasswordError('Пароли не совпадают');
    setSavingPassword(true);
    setPasswordError(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) return setPasswordError(error.message);
    setNewPassword('');
    setConfirmPassword('');
    showToast('Пароль изменён', 'success');
  };

  const initials = nickname ? nickname.substring(0, 2).toUpperCase() : '??';

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4 overflow-y-auto"
      onClick={() => !isBusy && onClose()}
    >
      <div
        className="bg-neutral-900 rounded-2xl max-w-lg w-full my-8 relative border border-neutral-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={isBusy}
          className="absolute top-4 right-4 w-8 h-8 bg-neutral-800 hover:bg-neutral-700 rounded-full flex items-center justify-center transition disabled:opacity-50 z-10"
        >
          <X className="w-4 h-4 text-neutral-400" />
        </button>

        <div className="px-6 pt-6 pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Настройки профиля</h2>
              <p className="text-xs text-neutral-400">Профиль и безопасность</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setTab('profile')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === 'profile' ? 'bg-indigo-500 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              Профиль
            </button>
            <button
              onClick={() => setTab('security')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5 ${
                tab === 'security' ? 'bg-indigo-500 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              Безопасность
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
          {tab === 'profile' && (
            <>
              <div>
                <label className="text-xs font-medium text-neutral-400 mb-3 block">Аватар</label>
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                    {avatarUrl ? (
                      <Image src={avatarUrl} alt="avatar" fill sizes="80px" className="object-cover" unoptimized />
                    ) : (
                      <span className="text-2xl font-bold text-white">{initials}</span>
                    )}
                    {uploading && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleAvatarSelect(f);
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full px-4 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-300 text-sm font-medium rounded-lg transition flex items-center justify-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      {avatarUrl ? 'Заменить' : 'Загрузить'}
                    </button>
                    {avatarUrl && (
                      <button
                        onClick={handleAvatarDelete}
                        disabled={uploading}
                        className="w-full px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 disabled:opacity-50 text-red-400 text-sm font-medium rounded-lg transition flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Удалить
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-400 mb-2 block">Никнейм *</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={30}
                  className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Твой ник"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-400 mb-2 flex items-center gap-1.5">
                  <AtSign className="w-3 h-3" /> Настоящее имя
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={50}
                  className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Как тебя зовут"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-neutral-400 mb-2 flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" /> Регион
                  </label>
                  <input
                    type="text"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    maxLength={50}
                    className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Область"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-400 mb-2 flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" /> Город
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    maxLength={50}
                    className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Город"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-400 mb-2 flex items-center gap-1.5">
                  <Link2 className="w-3 h-3" /> Steam-профиль
                </label>
                <input
                  type="text"
                  value={steamUrl}
                  onChange={(e) => setSteamUrl(e.target.value)}
                  className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://steamcommunity.com/id/username"
                />
              </div>

              {profileError && (
                <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                  {profileError}
                </div>
              )}

              <button
                onClick={handleSaveProfile}
                disabled={savingProfile || uploading}
                className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition flex items-center justify-center gap-2"
              >
                {savingProfile ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Сохраняем...</>
                ) : (
                  <><Save className="w-4 h-4" /> Сохранить</>
                )}
              </button>
            </>
          )}

          {tab === 'security' && (
            <>
              <div className="bg-neutral-800/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-white">Email</h3>
                </div>
                <p className="text-xs text-neutral-500">
                  Текущий: <span className="text-neutral-300">{userEmail || '—'}</span>
                </p>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="new@example.com"
                />
                {emailError && (
                  <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
                    {emailError}
                  </div>
                )}
                <button
                  onClick={handleSaveEmail}
                  disabled={savingEmail}
                  className="w-full px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2"
                >
                  {savingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Изменить email'}
                </button>
              </div>

              <div className="bg-neutral-800/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-white">Пароль</h3>
                </div>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Новый пароль"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Повтори пароль"
                />
                {passwordError && (
                  <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
                    {passwordError}
                  </div>
                )}
                <button
                  onClick={handleSavePassword}
                  disabled={savingPassword || !newPassword || !confirmPassword}
                  className="w-full px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2"
                >
                  {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Изменить пароль'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}