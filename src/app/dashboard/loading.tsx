export default function DashboardLoading() {
  return (
    <div className="flex-1 p-6 bg-[var(--bg-primary)]">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header skeleton */}
        <div className="h-8 w-48 bg-[var(--bg-tertiary)] rounded animate-pulse" />
        
        {/* Stats grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
              <div className="h-4 w-20 bg-[var(--bg-tertiary)] rounded animate-pulse mb-2" />
              <div className="h-8 w-16 bg-[var(--bg-tertiary)] rounded animate-pulse" />
            </div>
          ))}
        </div>
        
        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="p-6 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
              <div className="h-5 w-32 bg-[var(--bg-tertiary)] rounded animate-pulse mb-4" />
              <div className="space-y-3">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-4 bg-[var(--bg-tertiary)] rounded animate-pulse" style={{ width: `${80 - j * 10}%` }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
