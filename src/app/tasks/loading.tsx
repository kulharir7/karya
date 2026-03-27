export default function TasksLoading() {
  return (
    <div className="flex-1 p-6 bg-[var(--bg-primary)]">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header skeleton */}
        <div className="flex justify-between items-center">
          <div className="h-8 w-24 bg-[var(--bg-tertiary)] rounded animate-pulse" />
          <div className="h-10 w-32 bg-[var(--bg-tertiary)] rounded-lg animate-pulse" />
        </div>
        
        {/* Task list skeleton */}
        <div className="grid gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
              <div className="flex items-center justify-between mb-3">
                <div className="h-5 w-40 bg-[var(--bg-tertiary)] rounded animate-pulse" />
                <div className="h-6 w-16 bg-[var(--bg-tertiary)] rounded-full animate-pulse" />
              </div>
              <div className="h-3 w-full bg-[var(--bg-tertiary)] rounded animate-pulse mb-2" />
              <div className="flex gap-4">
                <div className="h-3 w-20 bg-[var(--bg-tertiary)] rounded animate-pulse" />
                <div className="h-3 w-24 bg-[var(--bg-tertiary)] rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
