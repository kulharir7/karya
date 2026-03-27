export default function HelpLoading() {
  return (
    <div className="flex-1 p-6 bg-[var(--bg-primary)]">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header skeleton */}
        <div className="h-8 w-24 bg-[var(--bg-tertiary)] rounded animate-pulse" />
        
        {/* Search skeleton */}
        <div className="h-12 bg-[var(--bg-tertiary)] rounded-xl animate-pulse" />
        
        {/* Tabs skeleton */}
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-24 bg-[var(--bg-tertiary)] rounded-lg animate-pulse" />
          ))}
        </div>
        
        {/* Tool cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-[var(--bg-tertiary)] rounded animate-pulse" />
                <div className="h-4 w-24 bg-[var(--bg-tertiary)] rounded animate-pulse" />
              </div>
              <div className="h-3 w-full bg-[var(--bg-tertiary)] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
