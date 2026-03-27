export default function MemoryLoading() {
  return (
    <div className="flex-1 p-6 bg-[var(--bg-primary)]">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header skeleton */}
        <div className="h-8 w-28 bg-[var(--bg-tertiary)] rounded animate-pulse" />
        
        {/* Search skeleton */}
        <div className="h-12 bg-[var(--bg-tertiary)] rounded-xl animate-pulse" />
        
        {/* File list skeleton */}
        <div className="grid gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center gap-4">
              <div className="w-10 h-10 bg-[var(--bg-tertiary)] rounded-lg animate-pulse" />
              <div className="flex-1">
                <div className="h-4 w-32 bg-[var(--bg-tertiary)] rounded animate-pulse mb-2" />
                <div className="h-3 w-20 bg-[var(--bg-tertiary)] rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
