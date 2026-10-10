// Графика достижений: у каждого достижения своя форма рамки, свой символ и свой цвет.
// Ранг (бронза → алмаз) меняет металл рамки, уровень 1–10 показывается числом на значке.

export type TierKey = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface Tier {
  key: TierKey;
  name: string;
  light: string;
  mid: string;
  dark: string;
  glow: string;
}

export const TIERS: Tier[] = [
  { key: 'bronze',   name: 'Бронза',  light: '#f6c08f', mid: '#c97b3d', dark: '#7a4220', glow: 'rgba(201,123,61,0.45)' },
  { key: 'silver',   name: 'Серебро', light: '#f4f7fb', mid: '#a9b4c4', dark: '#5b6678', glow: 'rgba(169,180,196,0.45)' },
  { key: 'gold',     name: 'Золото',  light: '#fff3b0', mid: '#f5c542', dark: '#a8730a', glow: 'rgba(245,197,66,0.55)' },
  { key: 'platinum', name: 'Платина', light: '#e3f8ff', mid: '#7fd6f0', dark: '#2f7fa3', glow: 'rgba(127,214,240,0.55)' },
  { key: 'diamond',  name: 'Алмаз',   light: '#f7e6ff', mid: '#b57bff', dark: '#5a2fd1', glow: 'rgba(181,123,255,0.7)' },
];

/** Номер ранга (0–4) по уровню 1–10; -1, если достижение ещё не открыто. */
export function tierIndexForLevel(level: number): number {
  if (level <= 0) return -1;
  return Math.min(4, Math.floor((level - 1) / 2));
}

export function tierForLevel(level: number): Tier | null {
  const i = tierIndexForLevel(level);
  return i < 0 ? null : TIERS[i];
}

// ---------- Рамки (viewBox 0 0 100 100) ----------

function poly(n: number, r: number, startDeg: number): string {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((startDeg + (360 / n) * i) * Math.PI) / 180;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

function starPoly(n: number, rOuter: number, rInner: number, startDeg: number): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = ((startDeg + (180 / n) * i) * Math.PI) / 180;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

type Frame = { kind: 'poly'; points: string } | { kind: 'path'; d: string } | { kind: 'circle' } | { kind: 'rect'; rx: number };

const FRAMES: Record<string, Frame> = {
  hexagon:    { kind: 'poly', points: poly(6, 45, -90) },
  shield:     { kind: 'path', d: 'M50 5 L88 17 V48 C88 71 72 87 50 96 C28 87 12 71 12 48 V17 Z' },
  octagon:    { kind: 'poly', points: poly(8, 46, -67.5) },
  seal:       { kind: 'poly', points: starPoly(12, 47, 41, -90) },
  diamond:    { kind: 'poly', points: '50,4 96,50 50,96 4,50' },
  banner:     { kind: 'path', d: 'M14 93 V42 C14 20 30 7 50 7 C70 7 86 20 86 42 V93 L50 76 Z' },
  squircle:   { kind: 'rect', rx: 30 },
  circle:     { kind: 'circle' },
  pentagon:   { kind: 'poly', points: poly(5, 47, -90) },
};

// ---------- Символы (viewBox 0 0 24 24, рисуются «чернилами» цвета ранга) ----------

const GLYPHS: Record<string, string> = {
  // Три сложенные карточки-картриджа
  stack:
    '<rect x="6" y="3" width="12" height="4" rx="1.4"/><rect x="4.5" y="9" width="15" height="4" rx="1.4" opacity=".85"/><rect x="3" y="15" width="18" height="5" rx="1.6" opacity=".7"/>',
  // Клетчатый финишный флаг
  flag:
    '<rect x="4" y="3" width="2" height="18" rx="1"/><path d="M6 4h13v10H6z" opacity=".25"/><rect x="6" y="4" width="3.25" height="2.5"/><rect x="12.5" y="4" width="3.25" height="2.5"/><rect x="9.25" y="6.5" width="3.25" height="2.5"/><rect x="15.75" y="6.5" width="3.25" height="2.5"/><rect x="6" y="9" width="3.25" height="2.5"/><rect x="12.5" y="9" width="3.25" height="2.5"/><rect x="9.25" y="11.5" width="3.25" height="2.5"/><rect x="15.75" y="11.5" width="3.25" height="2.5"/>',
  // Пламя
  flame:
    '<path d="M12.5 2c.6 3.4 4.5 5.2 4.5 10a5 5 0 0 1-10 0c0-2 .9-3.4 2-4.5.1 1.7.9 2.7 1.8 3C10.4 7.6 11 4.2 12.5 2z"/><path d="M12 21a2.6 2.6 0 0 1-2.6-2.6c0-1.5 1.2-2.4 2.6-3.9 1.4 1.5 2.6 2.4 2.6 3.9A2.6 2.6 0 0 1 12 21z" opacity=".55"/>',
  // Звезда с искрами
  star:
    '<path d="M12 2.5l2.7 5.7 6.2.8-4.6 4.3 1.2 6.2L12 16.4 6.5 19.5l1.2-6.2L3.1 9l6.2-.8z"/><circle cx="20" cy="4" r="1.2" opacity=".8"/><circle cx="4" cy="3.5" r=".9" opacity=".6"/>',
  // Раскрытая книга с пером
  book:
    '<path d="M2.5 5.5C5.5 4.3 9 4.4 12 6.3v13.2c-3-1.7-6.5-1.8-9.5-.6z"/><path d="M21.5 5.5C18.5 4.3 15 4.4 12 6.3v13.2c3-1.7 6.5-1.8 9.5-.6z" opacity=".7"/><path d="M17.5 1.5l2.4 2.4-5.4 5.4-3 .6.6-3z" opacity=".95"/>',
  // Компас
  compass:
    '<circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16.8 7.2l-2.4 6.6-6.6 2.4 2.4-6.6z"/><circle cx="12" cy="12" r="1.3" fill="#14141c"/>',
  // Геймпад
  pad:
    '<path d="M7.2 6.5h9.6c2.3 0 3.6 1.5 4.3 4.6l.9 4.2c.4 2-.7 3.7-2.5 3.7-1.2 0-2-.5-3-1.6l-1.2-1.3H8.7l-1.2 1.3c-1 1.1-1.8 1.6-3 1.6-1.800 0-2.900-1.700-2.500-3.700l.9-4.200C3.600 8 4.900 6.500 7.200 6.500z"/><rect x="6" y="9.6" width="1.6" height="4.4" rx=".6" fill="#14141c"/><rect x="4.6" y="11" width="4.4" height="1.6" rx=".6" fill="#14141c"/><circle cx="16" cy="10.6" r="1.1" fill="#14141c"/><circle cx="18.2" cy="12.8" r="1.1" fill="#14141c"/>',
  // Мишень
  target:
    '<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="5.6" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.2"/><path d="M12 12l8-8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M17.2 3.2l.6 3 3 .6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  // Треснувшее сердце
  brokenheart:
    '<path d="M12 21s-8-5-9.6-10.2A5 5 0 0 1 11.200 6.500L12 7.500l.8-1A5 5 0 0 1 21.600 10.800C20 16 12 21 12 21z"/><path d="M12 7.500l-1.800 3.200 2.600 1.800-1.800 3.700" fill="none" stroke="#14141c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
};

export interface AchievementArt {
  frame: keyof typeof FRAMES;
  glyph: keyof typeof GLYPHS;
  /** Фирменный цвет достижения (подсветка внутренней плашки) */
  accent: string;
}

export const ACHIEVEMENT_ART: Record<string, AchievementArt> = {
  collector:     { frame: 'hexagon',  glyph: 'stack',       accent: '#6366f1' },
  finisher:      { frame: 'shield',   glyph: 'flag',        accent: '#10b981' },
  hardcore:      { frame: 'octagon',  glyph: 'flame',       accent: '#f97316' },
  critic:        { frame: 'seal',     glyph: 'star',        accent: '#eab308' },
  writer:        { frame: 'diamond',  glyph: 'book',        accent: '#0ea5e9' },
  explorer:      { frame: 'banner',   glyph: 'compass',     accent: '#14b8a6' },
  gamer:         { frame: 'squircle', glyph: 'pad',         accent: '#3b82f6' },
  perfectionist: { frame: 'circle',   glyph: 'target',      accent: '#f43f5e' },
  picky:         { frame: 'pentagon', glyph: 'brokenheart', accent: '#d946ef' },
};

function frameMarkup(frame: Frame, attrs: string, transform = ''): string {
  const t = transform ? ` transform="${transform}"` : '';
  switch (frame.kind) {
    case 'poly':
      return `<polygon points="${frame.points}" ${attrs} stroke-linejoin="round"${t}/>`;
    case 'path':
      return `<path d="${frame.d}" ${attrs} stroke-linejoin="round"${t}/>`;
    case 'circle':
      return `<circle cx="50" cy="50" r="45" ${attrs}${t}/>`;
    case 'rect':
      return `<rect x="7" y="7" width="86" height="86" rx="${frame.rx}" ${attrs}${t}/>`;
  }
}

/**
 * Возвращает готовый SVG значка. level = 0 — достижение не открыто (серый значок).
 */
export function renderBadgeSvg(id: string, level: number, size = 96): string {
  const art = ACHIEVEMENT_ART[id] || ACHIEVEMENT_ART.collector;
  const frame = FRAMES[art.frame];
  const tier = tierForLevel(level);
  const locked = !tier;

  const light = tier ? tier.light : '#6b7280';
  const mid = tier ? tier.mid : '#4b5563';
  const dark = tier ? tier.dark : '#262b33';
  const ink = tier ? tier.light : '#6b7280';
  const gid = `${id}-${tier ? tier.key : 'locked'}`;

  const defs =
    `<defs>` +
    `<clipPath id="c-${gid}">${frameMarkup(frame, '')}</clipPath>` +
    `<linearGradient id="f-${gid}" x1="15%" y1="0%" x2="85%" y2="100%">` +
    `<stop offset="0" stop-color="${light}"/><stop offset=".45" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></linearGradient>` +
    `<radialGradient id="p-${gid}" cx="50%" cy="38%" r="75%">` +
    `<stop offset="0" stop-color="${locked ? '#2b2f37' : art.accent}" stop-opacity="${locked ? 1 : 0.55}"/>` +
    `<stop offset="1" stop-color="#0f1015"/></radialGradient>` +
    `</defs>`;

  // Внешняя рамка + внутренняя тёмная плашка (та же форма, уменьшенная)
  const outer = frameMarkup(frame, `fill="url(#f-${gid})" stroke="${dark}" stroke-width="2"`);
  const inner = frameMarkup(
    frame,
    `fill="url(#p-${gid})" stroke="${locked ? '#1b1e24' : 'rgba(0,0,0,.45)'}" stroke-width="1.5"`,
    'translate(50 50) scale(.76) translate(-50 -50)',
  );

  // Блик на рамке
  const shine = locked
    ? ''
    : `<g clip-path="url(#c-${gid})"><path d="M10 40 C14 18 34 6 66 6 C46 16 32 28 26 52 Z" fill="#fff" opacity=".26"/></g>`;

  // Символ по центру: 24×24 → масштаб 1.85 (≈44 px) в центр 100×100
  const glyph =
    `<g transform="translate(27.7 25.7) scale(1.85)" fill="${ink}" color="${ink}">${GLYPHS[art.glyph]}</g>`;

  // Бейдж с номером уровня
  const chip =
    tier && level > 0
      ? `<g><circle cx="50" cy="90" r="10" fill="${dark}" stroke="${light}" stroke-width="1.6"/>` +
        `<text x="50" y="94" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="${level >= 10 ? 9 : 11}" font-weight="800" fill="${light}">${level}</text></g>`
      : '';

  // Искры на алмазном ранге
  const sparkles =
    tier && tier.key === 'diamond'
      ? `<g fill="#fff"><path d="M86 14l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" opacity=".9"/><path d="M12 70l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z" opacity=".7"/></g>`
      : '';

  const opacity = locked ? ' opacity=".85"' : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-hidden="true"${opacity}>` +
    defs +
    outer +
    inner +
    shine +
    glyph +
    chip +
    sparkles +
    `</svg>`
  );
}
