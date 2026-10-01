'use client';

import { useEffect, useState, use, useMemo, useCallback } from 'react';
import {
  Loader2, ThumbsUp, Trophy, Clock, Star, Check,
  Gamepad, XCircle, MessageSquare, ArrowLeft,
  MapPin, ExternalLink, Pencil, Heart, ChevronDown, ChevronUp,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { calculateLevel, Game, GameData } from '@/types/game';
import { mapRawgGame, RawgGame } from '@/lib/rawg';
import GameCard from '@/components/GameCard';
import GameCardSkeleton from '@/components/GameCardSkeleton';
import GameMediaCarousel from '@/components/GameMediaCarousel';
import SteamRating from '@/components/SteamRating';
import ReviewsSection from '@/components/ReviewsSection';
import EditProfileModal, { getBannerGradientClass } from '@/components/EditProfileModal';

type TopTab = 'games' | 'wishlist' | 'reviews';
type GameTab = 'all' | 'playing' | 'completed' | 'dropped';

interface PublicProfile {
  id: string;
  nickname: string;
  full_name: string;
  avatar_url: string | null;
  banner_url: string | null;
  banner_gradient: string;
  region: string;
  city: string;
  steam_url: string;
  xp: number;
  totalGames: number;
  completedGames: number;
  totalHours: number;
}

interface ProfileStats {
  likes: number;
  reviewsCount: number;
  reviewLikesSum: number;
  gamesCount: number;
}

interface ProfileReview {
  id: string;
  game_id: number;
  game_title: string;
  game_cover: string | null;
  rating: number | null;
  text: string;
  created_at: string;
}

interface UserGameRow {
  game_id: number;
  status: 'none' | 'want' | 'playing' | 'completed' | 'dropped';
  hours: number;
  rating: number;
  review: string;
  updated_at?: string;
}

interface ProfileCache {
  profile: PublicProfile;
  stats: ProfileStats;
  reviews: ProfileReview[];
  userGames: UserGameRow[];
  ts: number;
}

const CACHE_TTL = 60 * 1000; // 1 минута

function loadProfileCache(id: string): ProfileCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`playlog:user-cache:${id}`);
    if (!raw) return null;
    const parsed: ProfileCache = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_TTL) {
      sessionStorage.removeItem(`playlog:user-cache:${id}`);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveProfileCache(id: string, data: Omit<ProfileCache, 'ts'>) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      `playlog:user-cache:${id}`,
      JSON.stringify({ ...data, ts: Date.now() }),
    );
  } catch {}
}

function clearProfileCache(id: string) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(`playlog:user-cache:${id}`);
  } catch {}
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} дн назад`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} мес назад`;
  return `${Math.floor(months / 12)} г назад`;
}

export default function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { userId, profile: myProfile, setProfile: setMyProfile } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [reviews, setReviews] = useState<ProfileReview[]>([]);
  const [userGames, setUserGames] = useState<UserGameRow[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TopTab>('games');
  const [gameTab, setGameTab] = useState<GameTab>('all');

  // === Модалка игры ===
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [gameModalLoading, setGameModalLoading] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [descriptionRu, setDescriptionRu] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(0);

  const isOwnProfile = userId === id;

  // ============= Загрузка игр по IDs =============
  const loadGamesByIds = useCallback(async (ids: number[]) => {
    if (ids.length === 0) {
      setGames([]);
      return;
    }
    setGamesLoading(true);
    try {
      const res = await fetch(`/api/games/batch?ids=${ids.join(',')}`);
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.results || []).map((g: RawgGame) => mapRawgGame(g));
        setGames(mapped);
      }
    } catch (err) {
      console.error('Games batch error:', err);
    } finally {
      setGamesLoading(false);
    }
  }, []);

  // ============= Рефреш профиля =============
  const refreshProfile = useCallback(
    async (showLoader = false) => {
      if (showLoader) setLoading(true);
      try {
        clearProfileCache(id);

        const res = await fetch(`/api/users/${id}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        setPublicProfile(data.profile);
        setStats(data.stats);
        setLikesCount(data.stats?.likes || 0);
        setReviews(data.reviews || []);
        setUserGames(data.userGames || []);

        if (userId === id) {
          setMyProfile((prev) => ({
            ...prev,
            nickname: data.profile.nickname,
            avatarUrl: data.profile.avatar_url || undefined,
          }));
        }

        saveProfileCache(id, {
          profile: data.profile,
          stats: data.stats,
          reviews: data.reviews || [],
          userGames: data.userGames || [],
        });

        if (data.userGames?.length > 0) {
          const ids = data.userGames.map((g: UserGameRow) => g.game_id);
          await loadGamesByIds(ids);
        } else {
          setGames([]);
        }
      } catch (err) {
        console.error('Profile refresh error:', err);
      } finally {
        setLoading(false);
      }
    },
    [id, userId, setMyProfile, loadGamesByIds],
  );

  // ============= Первая загрузка =============
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const cached = loadProfileCache(id);
      if (cached && !cancelled) {
        setPublicProfile(cached.profile);
        setStats(cached.stats);
        setReviews(cached.reviews);
        setUserGames(cached.userGames);
        setLikesCount(cached.stats?.likes || 0);
        setLoading(false);
        loadGamesByIds(cached.userGames.map((g) => g.game_id));
      } else {
        setLoading(true);
      }

      try {
        const res = await fetch(`/api/users/${id}`, { cache: 'no-store' });
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;

        setPublicProfile(data.profile);
        setStats(data.stats);
        setLikesCount(data.stats?.likes || 0);
        setReviews(data.reviews || []);
        setUserGames(data.userGames || []);
        setLoading(false);

        saveProfileCache(id, {
          profile: data.profile,
          stats: data.stats,
          reviews: data.reviews || [],
          userGames: data.userGames || [],
        });

        const likePromise =
          userId && userId !== id
            ? fetch(`/api/users/like?user_id=${userId}&target_id=${id}`)
                .then((r) => r.json())
                .catch(() => ({ liked: false }))
            : Promise.resolve({ liked: false });

        if (data.userGames?.length > 0) {
          const ids = data.userGames.map((g: UserGameRow) => g.game_id);
          const [, likeData] = await Promise.all([loadGamesByIds(ids), likePromise]);
          if (!cancelled && likeData) setLiked(likeData.liked);
        } else {
          const likeData = await likePromise;
          if (!cancelled) setLiked(likeData.liked);
        }
      } catch (err) {
        console.error('Profile load error:', err);
        if (!cancelled) setNotFound(true);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, userId]);

  // ============= Escape для модалки =============
  useEffect(() => {
    if (!selectedGame) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedScreenshot) {
          setSelectedScreenshot(null);
        } else {
          closeGameModal();
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [selectedGame, selectedScreenshot]);

  // ============= Лайк профиля =============
  const handleLike = async () => {
    if (!userId) return showToast('Войди, чтобы ставить лайки', 'info');
    if (isOwnProfile) return;

    setLikeLoading(true);
    const oldLiked = liked;
    const oldCount = likesCount;
    setLiked(!liked);
    setLikesCount(liked ? likesCount - 1 : likesCount + 1);

    try {
      const res = await fetch('/api/users/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, targetId: id }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setLiked(oldLiked);
      setLikesCount(oldCount);
      showToast('Не удалось поставить лайк', 'error');
    }
    setLikeLoading(false);
  };

  // ============= Открытие модалки игры =============
  const openGameModal = async (game: Game) => {
    setSelectedGame(game);
    setGameModalLoading(true);
    setDescriptionExpanded(false);
    setDescriptionRu(null);
    setTranslating(false);
    setSelectedScreenshot(null);

    try {
      const res = await fetch(`/api/games/${game.id}?full=true`);
      if (res.ok) {
        const rawData = await res.json();
        const fullGame = mapRawgGame(rawData);
        setSelectedGame(fullGame);
        if (fullGame.descriptionRaw) {
          translateDescription(fullGame.descriptionRaw, game.id);
        }
      }
    } catch (err) {
      console.error('Open game error:', err);
    }
    setGameModalLoading(false);
  };

  const closeGameModal = () => {
    setSelectedGame(null);
    setDescriptionExpanded(false);
    setDescriptionRu(null);
    setSelectedScreenshot(null);
  };

  const translateDescription = async (text: string, gameId: number) => {
    const cached = localStorage.getItem(`translation_${gameId}`);
    if (cached) {
      setDescriptionRu(cached);
      return;
    }
    if (/[а-яА-ЯёЁ]/.test(text)) {
      setDescriptionRu(text);
      localStorage.setItem(`translation_${gameId}`, text);
      return;
    }
    setTranslating(true);
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      if (data.translatedText) {
        setDescriptionRu(data.translatedText);
        localStorage.setItem(`translation_${gameId}`, data.translatedText);
      } else if (data.error) {
        console.error('Translation error:', data.error);
        setDescriptionRu(text);
      }
    } catch (error) {
      console.error('Translation error:', error);
      setDescriptionRu(text);
    }
    setTranslating(false);
  };

  // ============= Сохранение профиля =============
  const handleProfileSaved = async (updated: {
    nickname?: string;
    avatarUrl?: string;
    bannerUrl?: string | null;
    bannerGradient?: string;
    fullName?: string;
    region?: string;
    city?: string;
    steamUrl?: string;
  }) => {
    setPublicProfile((prev) =>
      prev
        ? {
            ...prev,
            nickname: updated.nickname ?? prev.nickname,
            avatar_url: updated.avatarUrl ?? prev.avatar_url,
            banner_url: updated.bannerUrl !== undefined ? updated.bannerUrl : prev.banner_url,
            banner_gradient: updated.bannerGradient ?? prev.banner_gradient,
            full_name: updated.fullName ?? prev.full_name,
            region: updated.region ?? prev.region,
            city: updated.city ?? prev.city,
            steam_url: updated.steamUrl ?? prev.steam_url,
          }
        : prev,
    );

    if (userId === id) {
      setMyProfile((prev) => ({
        ...prev,
        nickname: updated.nickname ?? prev.nickname,
        avatarUrl: updated.avatarUrl ?? prev.avatarUrl,
      }));
    }

    clearProfileCache(id);
  };

  // ============= useMemo =============
  const userGamesData = useMemo(() => {
    const map = new Map<number, GameData>();
    userGames.forEach((ug) => {
      map.set(ug.game_id, {
        rating: ug.rating || 0,
        hours: ug.hours || 0,
        review: ug.review || '',
        status: ug.status || 'none',
        xp: 0,
      });
    });
    return map;
  }, [userGames]);

  // Карта "когда последний раз меняли запись"
  const updatedAtMap = useMemo(() => {
    const map = new Map<number, number>();
    userGames.forEach((ug) => {
      const t = ug.updated_at ? new Date(ug.updated_at).getTime() : 0;
      map.set(ug.game_id, t);
    });
    return map;
  }, [userGames]);

  const statusCounts = useMemo(
    () => ({
      all: userGames.length,
      want: userGames.filter((g) => g.status === 'want').length,
      playing: userGames.filter((g) => g.status === 'playing').length,
      completed: userGames.filter((g) => g.status === 'completed').length,
      dropped: userGames.filter((g) => g.status === 'dropped').length,
    }),
    [userGames],
  );

  // Коллекция — все кроме want, отсортированные по updated_at DESC
  const collectionGames = useMemo(() => {
    const filtered = games.filter((g) => userGamesData.get(g.id)?.status !== 'want');
    return [...filtered].sort((a, b) => {
      const tA = updatedAtMap.get(a.id) || 0;
      const tB = updatedAtMap.get(b.id) || 0;
      return tB - tA;
    });
  }, [games, userGamesData, updatedAtMap]);

  // Лист ожидания — тоже по updated_at DESC
  const wishlistGames = useMemo(() => {
    const filtered = games.filter((g) => userGamesData.get(g.id)?.status === 'want');
    return [...filtered].sort((a, b) => {
      const tA = updatedAtMap.get(a.id) || 0;
      const tB = updatedAtMap.get(b.id) || 0;
      return tB - tA;
    });
  }, [games, userGamesData, updatedAtMap]);

  const filteredCollectionGames = useMemo(() => {
    if (gameTab === 'all') return collectionGames;
    return collectionGames.filter((g) => userGamesData.get(g.id)?.status === gameTab);
  }, [collectionGames, gameTab, userGamesData]);

  const gameTabOptions: { id: GameTab; label: string; count: number; color: string }[] = [
    { id: 'all', label: 'Все', count: collectionGames.length, color: 'text-indigo-400' },
    { id: 'playing', label: 'Играю', count: statusCounts.playing, color: 'text-blue-400' },
    { id: 'completed', label: 'Пройдено', count: statusCounts.completed, color: 'text-emerald-400' },
    { id: 'dropped', label: 'Заброшено', count: statusCounts.dropped, color: 'text-neutral-400' },
  ];

  // ============= Заглушки =============
  if (loading && !publicProfile) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (notFound || !publicProfile) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center bg-neutral-900 border border-neutral-800 rounded-2xl p-8">
          <XCircle className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Профиль не найден</h1>
          <p className="text-sm text-neutral-400 mb-6">Такого пользователя не существует</p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition"
          >
            На главную
          </Link>
        </div>
      </div>
    );
  }

  const levelInfo = calculateLevel(publicProfile.xp);
  const initials = publicProfile.nickname.substring(0, 2).toUpperCase();
  const xpPercent = Math.min((levelInfo.xpInLevel / levelInfo.xpToNext) * 100, 100);

  const modalGameData = selectedGame ? userGamesData.get(selectedGame.id) : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад
        </button>

        {/* Профиль */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          <div
            className={`relative h-40 md:h-56 bg-gradient-to-br ${getBannerGradientClass(publicProfile.banner_gradient)}`}
          >
            {publicProfile.banner_url && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={publicProfile.banner_url}
                  alt={publicProfile.nickname}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              </>
            )}
          </div>

          <div className="p-6 md:p-8 -mt-16 md:-mt-20 relative">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-4">
              <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0 ring-4 ring-neutral-900">
                {publicProfile.avatar_url ? (
                  <Image
                    src={publicProfile.avatar_url}
                    alt={publicProfile.nickname}
                    fill
                    sizes="128px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="text-3xl md:text-4xl font-bold text-white">{initials}</span>
                )}
              </div>

              <div className="flex-1 min-w-0 pb-2">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h1 className="text-2xl md:text-3xl font-bold text-white truncate drop-shadow-lg">
                    {publicProfile.full_name || publicProfile.nickname}
                  </h1>
                  {isOwnProfile && (
                    <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-medium">
                      Это ты
                    </span>
                  )}
                </div>
                <div className="text-sm text-neutral-300 flex items-center gap-3 flex-wrap drop-shadow">
                  <span>@{publicProfile.nickname}</span>
                  {(publicProfile.city || publicProfile.region) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {[publicProfile.city, publicProfile.region].filter(Boolean).join(', ')}
                    </span>
                  )}
                </div>
                <div className="text-sm text-neutral-300 mt-1 drop-shadow">
                  Уровень {levelInfo.level} • {publicProfile.xp} XP
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {isOwnProfile ? (
                  <button
                    onClick={() => setEditOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium text-sm transition shadow-lg"
                  >
                    <Pencil className="w-4 h-4" />
                    Редактировать
                  </button>
                ) : (
                  <button
                    onClick={handleLike}
                    disabled={likeLoading}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition disabled:opacity-50 shadow-lg ${
                      liked
                        ? 'bg-indigo-500 text-white hover:bg-indigo-600'
                        : 'bg-neutral-800/90 backdrop-blur-sm text-neutral-200 hover:bg-neutral-700 border border-neutral-700'
                    }`}
                  >
                    <ThumbsUp className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
                    {likesCount > 0 ? likesCount : ''}
                    <span>{liked ? 'В избранном' : 'Лайкнуть'}</span>
                  </button>
                )}
              </div>
            </div>

                        {isOwnProfile && likesCount > 0 && (
              <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-medium">
                <ThumbsUp className="w-3.5 h-3.5 fill-current" />
                {likesCount} {likesCount === 1 ? 'лайк' : 'лайков'} от других игроков
              </div>
            )}

            {publicProfile.steam_url && (
              <a
                href={publicProfile.steam_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition"
              >
                <img
                  src="https://cdn.simpleicons.org/steam/66c0f4"
                  alt="Steam"
                  className="w-4 h-4"
                />
                Steam-профиль
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            <div className="mt-2 w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                style={{ width: `${xpPercent}%` }}
              />
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              {levelInfo.xpInLevel} / {levelInfo.xpToNext} XP
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-neutral-800">
              <div className="text-center">
                <Trophy className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
                <div className="text-lg md:text-xl font-bold text-white">
                  {publicProfile.totalGames}
                </div>
                <div className="text-xs text-neutral-400">Всего игр</div>
              </div>
              <div className="text-center">
                <Check className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                <div className="text-lg md:text-xl font-bold text-white">
                  {publicProfile.completedGames}
                </div>
                <div className="text-xs text-neutral-400">Пройдено</div>
              </div>
              <div className="text-center">
                <Clock className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                <div className="text-lg md:text-xl font-bold text-white">
                  {publicProfile.totalHours}h
                </div>
                <div className="text-xs text-neutral-400">Часов</div>
              </div>
              <div className="text-center">
                <MessageSquare className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
                <div className="text-lg md:text-xl font-bold text-white">
                  {stats?.reviewsCount || 0}
                </div>
                <div className="text-xs text-neutral-400">Рецензий</div>
              </div>
            </div>
          </div>
        </div>

        {/* Табы */}
        <div className="flex items-center gap-2 border-b border-neutral-800 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab('games')}
            className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap ${
              activeTab === 'games'
                ? 'text-indigo-400 border-indigo-500'
                : 'text-neutral-400 border-transparent hover:text-white'
            }`}
          >
            Коллекция игр ({collectionGames.length})
          </button>
          {statusCounts.want > 0 && (
            <button
              onClick={() => setActiveTab('wishlist')}
              className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'wishlist'
                  ? 'text-blue-400 border-blue-500'
                  : 'text-neutral-400 border-transparent hover:text-white'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              Лист ожидания ({statusCounts.want})
            </button>
          )}
          <button
            onClick={() => setActiveTab('reviews')}
            className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap ${
              activeTab === 'reviews'
                ? 'text-indigo-400 border-indigo-500'
                : 'text-neutral-400 border-transparent hover:text-white'
            }`}
          >
            Рецензии ({reviews.length})
          </button>
        </div>

        {/* Коллекция игр */}
        {activeTab === 'games' && (
          <div className="space-y-4">
            {collectionGames.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {gameTabOptions.map((opt) => {
                  const active = gameTab === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setGameTab(opt.id)}
                      className={`px-3.5 py-1.5 rounded-full text-xs md:text-sm font-medium transition flex items-center gap-1.5 ${
                        active
                          ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                          : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                      }`}
                    >
                      {opt.label}
                      <span className={active ? 'text-white/80' : opt.color}>
                        {opt.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {gamesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <GameCardSkeleton key={i} />
                ))}
              </div>
            ) : filteredCollectionGames.length === 0 ? (
              <div className="text-center py-12 bg-neutral-900 border border-neutral-800 rounded-xl">
                <Gamepad className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                <p className="text-sm text-neutral-400">
                  {collectionGames.length === 0
                    ? isOwnProfile
                      ? 'Ты ещё не добавил ни одной игры'
                      : 'Пользователь ещё не добавил игр'
                    : 'В этой категории пусто'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredCollectionGames.map((game, idx) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    onClick={() => openGameModal(game)}
                    userGameData={userGamesData.get(game.id)}
                    isAuthenticated={true}
                    index={idx}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Лист ожидания */}
        {activeTab === 'wishlist' && (
          <div className="space-y-4">
            {gamesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <GameCardSkeleton key={i} />
                ))}
              </div>
            ) : wishlistGames.length === 0 ? (
              <div className="text-center py-12 bg-neutral-900 border border-neutral-800 rounded-xl">
                <Heart className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                <p className="text-sm text-neutral-400">Лист ожидания пуст</p>
                {isOwnProfile && (
                  <Link
                    href="/releases"
                    className="inline-block mt-4 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition"
                  >
                    Посмотреть релизы
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {wishlistGames.map((game, idx) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    onClick={() => openGameModal(game)}
                    userGameData={userGamesData.get(game.id)}
                    isAuthenticated={true}
                    index={idx}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Рецензии */}
        {activeTab === 'reviews' && (
          <div>
            {reviews.length === 0 ? (
              <div className="text-center py-12 bg-neutral-900 border border-neutral-800 rounded-xl">
                <MessageSquare className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                <p className="text-sm text-neutral-400">
                  {isOwnProfile
                    ? 'Ты ещё не оставил ни одной рецензии'
                    : 'Пользователь ещё не написал рецензий'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="bg-neutral-900 border border-neutral-800 rounded-xl p-4"
                  >
                    <div className="flex gap-3">
                      {review.game_cover && (
                        <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden bg-neutral-800 flex-shrink-0">
                          <Image
                            src={review.game_cover}
                            alt={review.game_title}
                            fill
                            sizes="80px"
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-sm font-medium text-white truncate">
                            {review.game_title}
                          </h3>
                          {review.rating !== null && review.rating > 0 && (
                            <span className="flex items-center gap-0.5 text-xs text-yellow-400 font-bold flex-shrink-0">
                              <Star className="w-3 h-3 fill-yellow-400" />
                              {review.rating}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-300 line-clamp-3 leading-relaxed">
                          {review.text}
                        </p>
                        <div className="text-[11px] text-neutral-500 mt-2">
                          {timeAgo(review.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Модалка редактирования профиля */}
      {isOwnProfile && myProfile && userId && (
        <EditProfileModal
          isOpen={editOpen}
          onClose={() => {
            setEditOpen(false);
            refreshProfile(false);
          }}
          profile={myProfile}
          userId={userId}
          onUpdate={(updated) => {
            handleProfileSaved({
              nickname: updated.nickname,
              avatarUrl: updated.avatarUrl,
            });
          }}
        />
      )}

      {/* Модалка игры */}
      {selectedGame && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start md:items-center justify-center p-0 md:p-4 overflow-y-auto"
          onClick={closeGameModal}
        >
          <div
            className="bg-neutral-900 md:rounded-2xl w-full md:max-w-4xl max-h-screen md:max-h-[90vh] overflow-y-auto relative shadow-2xl border-0 md:border border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeGameModal}
              className="absolute top-3 right-3 w-10 h-10 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full flex items-center justify-center transition z-40"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {gameModalLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <span className="ml-3 text-neutral-400">Загрузка данных...</span>
              </div>
            ) : (
              <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
                <GameMediaCarousel
                  game={selectedGame}
                  onScreenshotClick={setSelectedScreenshot}
                  steamBadge={<SteamRating gameTitle={selectedGame.title} variant="badge" />}
                />

                {modalGameData && (
                  <div className="flex flex-wrap gap-2 items-center">
                    {modalGameData.status !== 'none' && (
                      <div
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                          modalGameData.status === 'want'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : modalGameData.status === 'playing'
                              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                              : modalGameData.status === 'completed'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-neutral-500/15 text-neutral-400 border border-neutral-500/30'
                        }`}
                      >
                        {modalGameData.status === 'want' && <Heart className="w-3.5 h-3.5" />}
                        {modalGameData.status === 'playing' && <Gamepad className="w-3.5 h-3.5" />}
                        {modalGameData.status === 'completed' && <Check className="w-3.5 h-3.5" />}
                        {modalGameData.status === 'dropped' && <XCircle className="w-3.5 h-3.5" />}
                        {modalGameData.status === 'want' && 'Хочу'}
                        {modalGameData.status === 'playing' && 'Играю'}
                        {modalGameData.status === 'completed' && 'Пройдено'}
                        {modalGameData.status === 'dropped' && 'Заброшено'}
                      </div>
                    )}
                    {modalGameData.rating > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 text-xs font-medium">
                        <Star className="w-3.5 h-3.5 fill-yellow-400" />
                        {modalGameData.rating}/10
                      </div>
                    )}
                    {modalGameData.hours > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/30 text-xs font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        {modalGameData.hours}ч
                      </div>
                    )}
                  </div>
                )}

                <div>
                  {translating ? (
                    <div className="flex items-center gap-3 p-3 md:p-4 bg-neutral-800 rounded-lg">
                      <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                      <div>
                        <div className="text-sm text-white font-medium">Переводим описание...</div>
                        <div className="text-xs text-neutral-400 mt-0.5">Google Translate</div>
                      </div>
                    </div>
                  ) : descriptionRu ? (
                    <div>
                      {descriptionExpanded ? (
                        <div>
                          <p className="text-neutral-300 leading-relaxed text-sm md:text-base">
                            {descriptionRu}
                          </p>
                          <button
                            onClick={() => setDescriptionExpanded(false)}
                            className="mt-2 text-sm text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1"
                          >
                            Свернуть
                            <ChevronUp className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <p className="text-neutral-300 leading-relaxed line-clamp-4 text-sm md:text-base">
                            {descriptionRu}
                          </p>
                          {descriptionRu.length > 300 && (
                            <button
                              onClick={() => setDescriptionExpanded(true)}
                              className="mt-2 text-sm text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1"
                            >
                              Читать полностью
                              <ChevronDown className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-neutral-400 leading-relaxed mb-3 line-clamp-3 text-sm md:text-base">
                        {selectedGame.description}
                      </p>
                      {selectedGame?.descriptionRaw && (
                        <button
                          onClick={() =>
                            translateDescription(selectedGame.descriptionRaw!, selectedGame.id)
                          }
                          className="text-sm text-indigo-400 hover:text-indigo-300 transition"
                        >
                          Перевести на русский
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {selectedGame.platforms.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                      Платформы
                    </h3>
                    <div className="flex gap-1.5 flex-wrap">
                      {selectedGame.platforms.map((platform) => (
                        <div
                          key={platform}
                          className="px-2.5 py-1 bg-neutral-800 rounded-lg text-xs text-neutral-300"
                        >
                          {platform}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isOwnProfile && (
                  <div className="pt-2">
                    <Link
                      href={`/?open=${selectedGame.id}`}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 font-medium rounded-lg transition text-sm"
                    >
                      <Pencil className="w-4 h-4" />
                      Оценить и написать рецензию
                    </Link>
                  </div>
                )}

                <div className="pt-4 border-t border-neutral-800">
                  <ReviewsSection gameId={selectedGame.id} refreshKey={savedTick} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Модалка скриншота */}
      {selectedScreenshot && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setSelectedScreenshot(null)}
        >
          <button
            onClick={() => setSelectedScreenshot(null)}
            className="absolute top-4 right-4 w-12 h-12 bg-neutral-800 hover:bg-neutral-700 rounded-full flex items-center justify-center transition z-10"
          >
            <XCircle className="w-6 h-6 text-white" />
          </button>
          <img
            src={selectedScreenshot}
            alt="Screenshot"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}