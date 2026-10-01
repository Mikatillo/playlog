export function getRatingColor(rating: number): string {
  if (rating >= 8) return 'text-emerald-400';
  if (rating >= 6) return 'text-yellow-400';
  if (rating >= 4) return 'text-orange-400';
  return 'text-red-400';
}

export function getSliderColor(value: number): string {
  if (value >= 8) return '#10b981';
  if (value >= 6) return '#eab308';
  if (value >= 4) return '#f97316';
  return '#ef4444';
}

export function getMetacriticColor(score: number): string {
  if (score >= 75) return 'bg-emerald-500/90 text-white';
  if (score >= 50) return 'bg-yellow-500/90 text-black';
  if (score >= 25) return 'bg-orange-500/90 text-white';
  return 'bg-red-500/90 text-white';
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'want':
      return 'bg-rose-500';
    case 'playing':
      return 'bg-blue-500';
    case 'completed':
      return 'bg-emerald-500';
    case 'dropped':
      return 'bg-neutral-500';
    default:
      return '';
  }
}
export function getSteamColor(percent: number): string {
  if (percent >= 90) return 'text-[#66c0f4]';   // Steam blue
  if (percent >= 75) return 'text-emerald-400';
  if (percent >= 60) return 'text-yellow-400';
  if (percent >= 40) return 'text-orange-400';
  return 'text-red-400';
}

export function getSteamBg(percent: number): string {
  if (percent >= 90) return 'bg-[#66c0f4]/15 border-[#66c0f4]/30';
  if (percent >= 75) return 'bg-emerald-500/15 border-emerald-500/30';
  if (percent >= 60) return 'bg-yellow-500/15 border-yellow-500/30';
  if (percent >= 40) return 'bg-orange-500/15 border-orange-500/30';
  return 'bg-red-500/15 border-red-500/30';
}