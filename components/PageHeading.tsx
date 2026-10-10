import type { LucideIcon } from 'lucide-react';

type Accent = 'indigo' | 'emerald' | 'amber' | 'sky' | 'rose' | 'fuchsia';

const ACCENTS: Record<Accent, { chip: string; glow: string }> = {
  indigo: { chip: 'from-indigo-500 to-violet-500', glow: 'shadow-indigo-500/30' },
  emerald: { chip: 'from-emerald-500 to-teal-400', glow: 'shadow-emerald-500/30' },
  amber: { chip: 'from-amber-400 to-orange-500', glow: 'shadow-amber-500/30' },
  sky: { chip: 'from-sky-500 to-cyan-400', glow: 'shadow-sky-500/30' },
  rose: { chip: 'from-rose-500 to-pink-400', glow: 'shadow-rose-500/30' },
  fuchsia: { chip: 'from-fuchsia-500 to-purple-500', glow: 'shadow-fuchsia-500/30' },
};

interface PageHeadingProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  accent?: Accent;
  children?: React.ReactNode;
}

/** Единый заголовок раздела: иконка в цветной плашке, название и подпись. */
export default function PageHeading({ icon: Icon, title, subtitle, accent = 'indigo', children }: PageHeadingProps) {
  const a = ACCENTS[accent];
  return (
    <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br ${a.chip} flex items-center justify-center shadow-lg ${a.glow} flex-shrink-0`}
        >
          <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-neutral-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
