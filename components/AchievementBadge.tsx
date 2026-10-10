'use client';

import { useMemo } from 'react';
import { renderBadgeSvg } from '@/lib/achievement-art';

interface AchievementBadgeProps {
  id: string;
  level: number;
  size?: number;
  className?: string;
}

/** Значок достижения: уникальная форма и символ, металл рамки зависит от уровня. */
export default function AchievementBadge({ id, level, size = 96, className }: AchievementBadgeProps) {
  const svg = useMemo(() => renderBadgeSvg(id, level, size), [id, level, size]);
  return (
    <span
      className={className}
      style={{ display: 'inline-block', width: size, height: size, lineHeight: 0 }}
      // Разметка полностью генерируется из констант в lib/achievement-art.ts, пользовательских данных в ней нет
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
