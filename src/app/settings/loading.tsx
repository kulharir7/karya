export default function SettingsLoading() {
  return (
    <div className="flex-1 p-6 bg-[var(--bg-primary)]">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header skeleton */}
        <div className="h-8 w-32 bg-[var(--bg-tertiary)] rounded animate-pulse" />
        
        {/* Settings sections skeleton */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-6 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
            <div className="h-5 w-24 bg-[var(--bg-tertiary)] rounded animate-pulse mb-4" />
            <div className="space-y-4">
              {[1, 2].map((j) => (
                <div key={j}>
                  <div className="h-4 w-20 bg-[var(--bg-tertiary)] rounded animate-pulse mb-2" />
                  <div className="h-10 bg-[var(--bg-tertiary)] rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
