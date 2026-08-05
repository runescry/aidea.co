/** PPR / Suspense fallback — matches FamilyWeekView layout without dynamic data. */
export default function FamilyHomeFallback() {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-surface-muted animate-pulse">
      <div className="max-w-[1040px] mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-10 w-full">
        <div className="h-8 w-48 rounded-md bg-surface-subtle mb-2" />
        <div className="h-4 w-36 rounded-md bg-surface-subtle mb-6" />
        <div className="h-7 w-56 rounded-full bg-surface-subtle mb-5" />
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] lg:grid-rows-2 gap-4">
          <div className="h-40 rounded-xl bg-surface border border-border" />
          <div className="h-40 rounded-xl bg-surface border border-border" />
          <div className="h-48 rounded-xl bg-surface border border-border" />
          <div className="h-48 rounded-xl bg-surface border border-border" />
        </div>
      </div>
    </div>
  );
}
