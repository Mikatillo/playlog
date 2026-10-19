export default function GameCardSkeleton() {
  return (
    <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
      <div className="aspect-[460/215] bg-neutral-800 animate-pulse" />
      <div className="p-3">
        <div className="h-5 w-3/4 bg-neutral-800 rounded animate-pulse" />
      </div>
    </div>
  );
}
