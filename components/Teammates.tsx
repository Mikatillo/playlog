'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Users, Loader2 } from 'lucide-react';

interface Teammate {
  id: string;
  nickname: string;
  avatar_url: string | null;
  hours_played: number;
}

interface TeammatesProps {
  gameId: number;
  currentUserId?: string;
}

export default function Teammates({ gameId, currentUserId }: TeammatesProps) {
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    
    fetch(`/api/games/${gameId}/teammates`)
      .then((r) => (r.ok ? r.json() : { teammates: [] }))
      .then((data) => {
        if (cancelled) return;
        setTeammates(data.teammates || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
      
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  if (loading) {
    return (
      <div className="bg-neutral-800 rounded-xl p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-indigo-500" />
          <h3 className="font-semibold text-white text-sm md:text-base">Тиммейты</h3>
        </div>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (teammates.length === 0) return null;

  return (
    <div className="bg-neutral-800 rounded-xl p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-white text-sm md:text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-500" />
          Тиммейты
          <span className="text-[11px] font-normal text-neutral-500">{teammates.length}</span>
        </h3>
      </div>

      <div className="space-y-2">
        {teammates.map((teammate) => (
          <Link
            key={teammate.id}
            href={`/user/${teammate.id}`}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-700/50 transition"
          >
            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-500 flex-shrink-0">
              {teammate.avatar_url ? (
                <Image
                  src={teammate.avatar_url}
                  alt={teammate.nickname}
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
                  {teammate.nickname.substring(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {teammate.nickname}
              </div>
              <div className="text-xs text-neutral-400">
                {teammate.hours_played}ч вместе
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
