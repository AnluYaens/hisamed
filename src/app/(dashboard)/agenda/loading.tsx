import { Skeleton } from '@/components/ui/skeleton';

// Route-level loading boundary for the agenda. Mirrors the header + controls +
// appointment list so the layout stays stable while data loads.
export default function AgendaLoading() {
  return (
    <div className="fade-in p-4 sm:p-8 lg:px-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-9 w-40" />
          <Skeleton className="mt-2 h-4 w-56" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>

      <Skeleton className="mb-4 h-9 w-full max-w-md" />

      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-[18px]" />
        ))}
      </div>
    </div>
  );
}
