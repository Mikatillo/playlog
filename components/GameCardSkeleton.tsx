export default function GameCardSkeleton() {
  return (
    <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
      <div className="aspect-video bg-neutral-800 animate-pulse" />
      <div className="p-3 space-y-2">
        <div className="flex flex-wrap gap-1">
          <div className="h-4 w-14 bg-neutral-800 rounded animate-pulse" />
          <div className="h-4 w-12 bg-neutral-800 rounded animate-pulse" />
        </div>
        <div className="flex items-center justify-between">
          <div className="h-3 w-10 bg-neutral-800 rounded animate-pulse" />
          <div className="h-3 w-16 bg-neutral-800 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}