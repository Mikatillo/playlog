'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil } from 'lucide-react';
import CreateGameModal from '@/components/CreateGameModal';
import { useIsAdmin } from '@/lib/use-admin';
import { isCustomId } from '@/lib/custom-games';
import { invalidateGame } from '@/lib/games-client';
import { emitGameUpdated } from '@/lib/game-events';
import type { Game } from '@/types/game';

interface AdminEditButtonProps {
  game: Game;
  userId: string | null | undefined;
  onSaved: (game: Game) => void;
}

/** Кнопка «Редактировать карточку» — только для админа и только для пользовательских карточек. */
export default function AdminEditButton({ game, userId, onSaved }: AdminEditButtonProps) {
  const isAdmin = useIsAdmin(userId);
  const [open, setOpen] = useState(false);

  if (!isAdmin || !userId) return null;
  const custom = isCustomId(game.id);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs font-medium text-amber-300 transition hover:bg-amber-500/10"
      >
        <Pencil className="w-4 h-4" />
        {custom ? 'Редактировать карточку (админ)' : 'Править карточку игры (админ)'}
      </button>
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <CreateGameModal
            userId={userId}
            editId={custom ? game.id : undefined}
            baseGame={custom ? undefined : game}
            onReset={async () => {
              invalidateGame(game.id);
              setOpen(false);
              try {
                const res = await fetch(`/api/games/${game.id}?t=${Date.now()}`, { cache: 'no-store' });
                if (res.ok) {
                  const fresh = await res.json();
                  emitGameUpdated(fresh);
                  onSaved(fresh);
                }
              } catch {}
            }}
            onClose={() => setOpen(false)}
            onCreated={(updated) => {
              invalidateGame(updated.id);
              setOpen(false);
              emitGameUpdated(updated);
              onSaved(updated);
            }}
          />,
          document.body,
        )}
    </>
  );
}
