'use client';

import { useEffect, useState, use, useMemo, useCallback } from 'react';
import {
  Loader2, Star, Check, Gamepad, XCircle, MessageSquare, ArrowLeft,
  Heart, ChevronDown, ChevronUp, ArrowUpDown, Pencil, X, Clock,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Game, GameData } from '@/types/game';
import { mapRawgGame, RawgGame } from '@/lib/rawg';
import GameCard from '@/components/GameCard';
import GameCardSkeleton from '@/components/GameCardSkeleton';
import GameMediaCarousel from '@/components/GameMediaCarousel';
import SteamRating from '@/components/SteamRating';
import ReviewsSection from '@/components/ReviewsSection';
import EditProfileModal from '@/components/EditProfileModal';
import ProfileHeader from '@/components/ProfileHeader';
import ActivityFeed from '@/components/ActivityFeed';

type TopTab = 'games' | 'wishlist' | 'reviews';
type GameTab = 'all' | 'playing' | 'completed' | 'dropped';
type SortType = 'newest' | 'oldest' | 'no-rating' | 'hours-desc' | 'hours-asc';

const sortOptions: { value: SortType; label: string }[] = [
  { value: 'newest', label: 'Новое' },
  { value: 'oldest', label: 'Старое' },
  { value: 'no-rating', label: 'Без оценки' },
  { value: 'hours-desc', label: 'Часы ↓' },
  { value: 'hours-asc', label: 'Часы ↑' },
];

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
  coins?: number;
  activeStatusId?: string | null;
  activeBackgroundId?: string | null;
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
  favorite_order?: number | null;
}

interface ProfileCache {
  profile: PublicProfile;
  stats: ProfileStats;
  reviews: ProfileReview[];
  userGames: UserGameRow[];
  ts: number;
}

const CACHE_TTL = 60 * 1000;

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
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TopTab>('games');
  const [gameTab, setGameTab] = useState<GameTab>('all');
  const [sortBy, setSortBy] = useState<SortType>('newest');

  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [gameModalLoading, setGameModalLoading] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [descriptionRu, setDescriptionRu] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [savedTick] = useState(0);

  // Фон страницы из магазина
  const [pageBackground, setPageBackground] = useState<string | null>(null);

  const isOwnProfile = userId === id;

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

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const cached = loadProfileCache(id);
      if (cached && !cancelled) {
        setPublicProfile(cached.profile);
        setStats(cached.stats);
        setReviews(cached.reviews);
        setUserGames(cached.userGames);
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
        setReviews(data.reviews || []);
        setUserGames(data.userGames || []);
        setLoading(false);

        saveProfileCache(id, {
          profile: data.profile,
          stats: data.stats,
          reviews: data.reviews || [],
          userGames: data.userGames || [],
        });

        const followPromise =
          userId && userId !== id
            ? fetch(`/api/follows?user_id=${userId}&target_id=${id}`)
                .then((r) => r.json())
                .catch(() => ({ following: false, count: 0 }))
            : fetch(`/api/follows?user_id=none&target_id=${id}`)
                .then((r) => r.json())
                .catch(() => ({ following: false, count: 0 }));

        if (data.userGames?.length > 0) {
          const ids = data.userGames.map((g: UserGameRow) => g.game_id);
          const [, followData] = await Promise.all([loadGamesByIds(ids), followPromise]);
          if (!cancelled && followData) {
            setIsFollowing(followData.following || false);
            setFollowersCount(followData.count || 0);
          }
        } else {
          const followData = await followPromise;
          if (!cancelled && followData) {
            setIsFollowing(followData.following || false);
            setFollowersCount(followData.count || 0);
          }
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

  // Загрузка фона страницы из магазина
  useEffect(() => {
    if (!publicProfile?.activeBackgroundId) {
      setPageBackground(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/shop?ids=${publicProfile.activeBackgroundId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const item = (data.items || [])[0];
        if (item?.value) setPageBackground(item.value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [publicProfile?.activeBackgroundId]);

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

  const handleToggleFollow = async () => {
    if (!userId) {
      showToast('Войди, чтобы подписаться', 'info');
      return;
    }
    if (isOwnProfile) return;

    setFollowLoading(true);
    const oldFollowing = isFollowing;
    const oldCount = followersCount;
    const newFollowing = !isFollowing;

    setIsFollowing(newFollowing);
    setFollowersCount(newFollowing ? followersCount + 1 : Math.max(0, followersCount - 1));

    try {
      const res = await fetch('/api/follows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, targetId: id }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setIsFollowing(oldFollowing);
      setFollowersCount(oldCount);
      showToast('Не удалось подписаться', 'error');
    }
    setFollowLoading(false);
  };

  const handleSetFavorite = async (gameId: number, order: number | null) => {
    if (!userId) return;

    setUserGames((prev) => {
      const cleaned = prev.map((ug) =>
        order !== null && ug.favorite_order === order
          ? { ...ug, favorite_order: null }
          : ug,
      );
      const idx = cleaned.findIndex((ug) => ug.game_id === gameId);
      if (idx === -1) return prev;
      const next = [...cleaned];
      next[idx] = { ...next[idx], favorite_order: order };
      return next;
    });

    try {
      if (order === null) {
        const res = await fetch(
          `/api/users/favorites?userId=${userId}&gameId=${gameId}`,
          { method: 'DELETE' },
        );
        if (!res.ok) throw new Error();
      } else {
        const res = await fetch('/api/users/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, gameId, order }),
        });
        if (!res.ok) throw new Error();
      }
      clearProfileCache(id);
    } catch {
      showToast('Не удалось обновить избранное', 'error');
      refreshProfile(false);
    }
  };

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
      } else {
        setDescriptionRu(text);
      }
    } catch (error) {
      console.error('Translation error:', error);
      setDescriptionRu(text);
    }
    setTranslating(false);
  };

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

  const userGamesData = useMemo(() => {
    const map = new Map<number, GameData>();
    userGames.forEach((ug) => {
      map.set(ug.game_id, {
        rating: ug.rating || 0,
        hours: ug.hours || 0,
        review: ug.review || '',
        status: ug.status || 'none',
        xp: 0,
        updatedAt: ug.updated_at,
      });
    });
    return map;
  }, [userGames]);

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

  const collectionGames = useMemo(() => {
    let filtered = games.filter((g) => userGamesData.get(g.id)?.status !== 'want');

    if (sortBy === 'no-rating') {
      filtered = filtered.filter((g) => (userGamesData.get(g.id)?.rating || 0) === 0);
    }

    return [...filtered].sort((a, b) => {
      const tA = updatedAtMap.get(a.id) || 0;
      const tB = updatedAtMap.get(b.id) || 0;
      const hoursA = userGamesData.get(a.id)?.hours || 0;
      const hoursB = userGamesData.get(b.id)?.hours || 0;

      switch (sortBy) {
        case 'newest':
        case 'no-rating':
          return tB - tA;
        case 'oldest':
          return tA - tB;
        case 'hours-desc':
          return hoursB - hoursA;
        case 'hours-asc':
          return hoursA - hoursB;
        default:
          return tB - tA;
      }
    });
  }, [games, userGamesData, updatedAtMap, sortBy]);

  const wishlistGames = useMemo(() => {
    let filtered = games.filter((g) => userGamesData.get(g.id)?.status === 'want');

    if (sortBy === 'no-rating') {
      filtered = filtered.filter((g) => (userGamesData.get(g.id)?.rating || 0) === 0);
    }

    return [...filtered].sort((a, b) => {
      const tA = updatedAtMap.get(a.id) || 0;
      const tB = updatedAtMap.get(b.id) || 0;
      const hoursA = userGamesData.get(a.id)?.hours || 0;
      const hoursB = userGamesData.get(b.id)?.hours || 0;

      switch (sortBy) {
        case 'newest':
        case 'no-rating':
          return tB - tA;
        case 'oldest':
          return tA - tB;
        case 'hours-desc':
          return hoursB - hoursA;
        case 'hours-asc':
          return hoursA - hoursB;
        default:
          return tB - tA;
      }
    });
  }, [games, userGamesData, updatedAtMap, sortBy]);

  const filteredCollectionGames = useMemo(() => {
    if (gameTab === 'all') return collectionGames;
    return collectionGames.filter((g) => userGamesData.get(g.id)?.status === gameTab);
  }, [collectionGames, gameTab, userGamesData]);

  const favoriteOrderMap = useMemo(() => {
    const map = new Map<number, number>();
    userGames.forEach((ug) => {
      if (ug.favorite_order && ug.favorite_order >= 1 && ug.favorite_order <= 3) {
        map.set(ug.game_id, ug.favorite_order);
      }
    });
    return map;
  }, [userGames]);

  const favoriteGames = useMemo(() => {
    return [...games]
      .filter((g) => favoriteOrderMap.has(g.id))
      .sort((a, b) => (favoriteOrderMap.get(a.id) || 0) - (favoriteOrderMap.get(b.id) || 0))
      .slice(0, 3);
  }, [games, favoriteOrderMap]);

  const topGenres = useMemo(() => {
    const counter = new Map<string, number>();
    collectionGames.forEach((g) => {
      const genres = g.genres;
      if (!genres) return;
      genres.forEach((genre) => {
        counter.set(genre.name, (counter.get(genre.name) || 0) + 1);
      });
    });
    return Array.from(counter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [collectionGames]);

  const gameTabOptions: { id: GameTab; label: string; count: number; color: string }[] = [
    { id: 'all', label: 'Все', count: collectionGames.length, color: 'text-indigo-400' },
    { id: 'playing', label: 'Играю', count: statusCounts.playing, color: 'text-blue-400' },
    { id: 'completed', label: 'Пройдено', count: statusCounts.completed, color: 'text-emerald-400' },
    { id: 'dropped', label: 'Заброшено', count: statusCounts.dropped, color: 'text-neutral-400' },
  ];

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

  const modalGameData = selectedGame ? userGamesData.get(selectedGame.id) : null;

  // Стиль фона страницы (градиент или картинка из магазина)
  const isImageBg = pageBackground?.startsWith('http');
  const pageBgStyle: React.CSSProperties = pageBackground
    ? isImageBg
      ? {
          backgroundImage: `url(${pageBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }
      : {
          backgroundImage: pageBackground,
          backgroundAttachment: 'fixed',
        }
    : {};

  return (
    <div className="min-h-screen bg-[#0a0a0a]" style={pageBgStyle}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition bg-neutral-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад
        </button>

        <ProfileHeader
          profile={{
            id: publicProfile.id,
            nickname: publicProfile.nickname,
            full_name: publicProfile.full_name,
            avatar_url: publicProfile.avatar_url,
            banner_url: publicProfile.banner_url,
            banner_gradient: publicProfile.banner_gradient,
            region: publicProfile.region,
            city: publicProfile.city,
            steam_url: publicProfile.steam_url,
            xp: publicProfile.xp,
            totalGames: publicProfile.totalGames,
            completedGames: publicProfile.completedGames,
            totalHours: publicProfile.totalHours,
            activeStatusId: publicProfile.activeStatusId,
            activeBackgroundId: publicProfile.activeBackgroundId,
          }}
          isOwnProfile={isOwnProfile}
          isFollowing={isFollowing}
          followersCount={followersCount}
          followLoading={followLoading}
          onToggleFollow={handleToggleFollow}
          onEdit={() => setEditOpen(true)}
          reviewsCount={stats?.reviewsCount || 0}
        />

        {/* 3 колонки: любимые игры / лента / интересы */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Любимые игры */}
          <div className="bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-2xl p-5">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />
              Мои любимые игры
            </h3>
            {favoriteGames.length === 0 ? (
              <div className="text-sm text-neutral-500 py-4">
                {isOwnProfile
                  ? 'Открой любую игру в коллекции и добавь её в слот 1, 2 или 3'
                  : 'Пользователь ещё не выбрал любимые игры'}
              </div>
            ) : (
              <div className="space-y-3">
                {favoriteGames.map((game) => {
                  const data = userGamesData.get(game.id);
                  const slot = favoriteOrderMap.get(game.id);
                  return (
                    <button
                      key={game.id}
                      onClick={() => openGameModal(game)}
                      className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-neutral-800/60 transition text-left"
                    >
                      <div className="relative w-12 h-16 rounded-lg overflow-hidden bg-neutral-800 flex-shrink-0">
                        {game.cover && (
                          <Image
                            src={game.cover}
                            alt={game.title}
                            fill
                            sizes="48px"
                            className="object-cover"
                            unoptimized
                          />
                        )}
                        {slot && (
                          <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-yellow-500 text-black text-[10px] font-bold flex items-center justify-center">
                            {slot}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {game.title}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs">
                          {data?.rating ? (
                            <span className="flex items-center gap-1 text-yellow-400 font-semibold">
                              <Star className="w-3 h-3 fill-yellow-400" />
                              {data.rating}/10
                            </span>
                          ) : null}
                          {data?.hours ? (
                            <span className="text-neutral-500">{data.hours}h</span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Лента активности */}
          <div className="bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-2xl p-5">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-500" />
              Лента активности
            </h3>
            <ActivityFeed
              userId={id}
              scope="user"
              showAvatars={false}
              limit={5}
              emptyText="Пока нет активности"
            />
          </div>

          {/* Интересы и статистика — горизонтальные полосы */}
          <div className="bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-2xl p-5 flex flex-col">
            <h3 className="font-semibold text-white mb-4">Интересы и статистика</h3>

            {/* Жанры */}
            <div className="flex flex-wrap gap-1.5 mb-5">
              {topGenres.length === 0 ? (
                <span className="text-sm text-neutral-500">Нет данных</span>
              ) : (
                topGenres.map(([genre, count]) => (
                  <span
                    key={genre}
                    className="px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-300 text-xs"
                  >
                    {genre} · {count}
                  </span>
                ))
              )}
            </div>

            {/* Статусы — горизонтальные полосы */}
            <div className="space-y-3 mt-auto">
              {[
                { label: 'Играю', count: statusCounts.playing, color: 'bg-indigo-500' },
                { label: 'Пройдено', count: statusCounts.completed, color: 'bg-emerald-500' },
                { label: 'Заброшено', count: statusCounts.dropped, color: 'bg-rose-500' },
              ].map(({ label, count, color }) => {
                const total =
                  statusCounts.playing + statusCounts.completed + statusCounts.dropped;
                const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                const w = Math.max((count / Math.max(total, 1)) * 100, count > 0 ? 4 : 0);

                return (
                  <div key={label}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-neutral-400">{label}</span>
                      <span className="text-neutral-300 font-medium">
                        {count}
                        <span className="text-neutral-500 ml-1.5">({percent}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${color} transition-all`}
                        style={{ width: `${w}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Табы + коллекция */}
        <div className="space-y-6 min-w-0">
          <div className="flex items-center gap-2 border-b border-neutral-800 overflow-x-auto scrollbar-hide bg-neutral-900/70 backdrop-blur-md rounded-t-xl px-2">
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

          {activeTab === 'games' && (
            <div className="space-y-4">
              {collectionGames.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 bg-neutral-900/70 backdrop-blur-md p-3 rounded-xl border border-neutral-800">
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
                  <div className="relative flex-shrink-0 ml-auto">
                    <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none z-10" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortType)}
                      className="appearance-none bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-lg pl-8 pr-7 py-1.5 text-xs md:text-sm font-medium text-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer transition"
                    >
                      {sortOptions.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-neutral-900">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500 pointer-events-none" />
                  </div>
                </div>
              )}

              {gamesLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <GameCardSkeleton key={i} />
                  ))}
                </div>
              ) : filteredCollectionGames.length === 0 ? (
                <div className="text-center py-12 bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-xl">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
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

          {activeTab === 'wishlist' && (
            <div className="space-y-4">
              {gamesLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <GameCardSkeleton key={i} />
                  ))}
                </div>
              ) : wishlistGames.length === 0 ? (
                <div className="text-center py-12 bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-xl">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
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

          {activeTab === 'reviews' && (
            <div>
              {reviews.length === 0 ? (
                <div className="text-center py-12 bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-xl">
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
                      className="bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-xl p-4"
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
      </div>

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

                {isOwnProfile && userGamesData.get(selectedGame.id) && (
                  <div>
                    <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                      Любимая игра
                    </h3>
                    <div className="flex gap-2 flex-wrap">
                      {[1, 2, 3].map((slot) => {
                        const currentSlot =
                          userGames.find((ug) => ug.game_id === selectedGame.id)
                            ?.favorite_order || null;
                        const isThis = currentSlot === slot;
                        const occupier = userGames.find((ug) => ug.favorite_order === slot);
                        const occupierGame = occupier
                          ? games.find((g) => g.id === occupier.game_id)
                          : null;
                        return (
                          <button
                            key={slot}
                            onClick={() => handleSetFavorite(selectedGame.id, slot)}
                            title={
                              occupierGame
                                ? `Сейчас в слоте: ${occupierGame.title}`
                                : 'Слот свободен'
                            }
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                              isThis
                                ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-300'
                                : 'bg-neutral-800 border border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                            }`}
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${isThis ? 'fill-yellow-300' : ''}`}
                            />
                            {isThis ? `Слот ${slot}` : `В слот ${slot}`}
                          </button>
                        );
                      })}
                      {userGames.find((ug) => ug.game_id === selectedGame.id)?.favorite_order && (
                        <button
                          onClick={() => handleSetFavorite(selectedGame.id, null)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500/25 transition"
                        >
                          Убрать
                        </button>
                      )}
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

      {selectedScreenshot && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setSelectedScreenshot(null)}
        >
          <button
            onClick={() => setSelectedScreenshot(null)}
            className="absolute top-4 right-4 w-12 h-12 bg-neutral-800 hover:bg-neutral-700 rounded-full flex items-center justify-center transition z-10"
          >
            <X className="w-6 h-6 text-white" />
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