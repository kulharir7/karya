export default function AuditLoading() {
  return (
    <div className="flex-1 p-6 bg-[var(--bg-primary)]">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header skeleton */}
        <div className="h-8 w-32 bg-[var(--bg-tertiary)] rounded animate-pulse" />
        
        {/* Filters skeleton */}
        <div className="flex gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-32 bg-[var(--bg-tertiary)] rounded-lg animate-pulse" />
          ))}
        </div>
        
        {/* Log entries skeleton */}
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center gap-4">
              <div className="w-8 h-8 bg-[var(--bg-tertiary)] rounded animate-pulse" />
              <div className="flex-1">
                <div className="h-4 w-40 bg-[var(--bg-tertiary)] rounded animate-pulse mb-1" />
                <div className="h-3 w-24 bg-[var(--bg-tertiary)] rounded animate-pulse" />
              </div>
              <div className="h-4 w-16 bg-[var(--bg-tertiary)] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
