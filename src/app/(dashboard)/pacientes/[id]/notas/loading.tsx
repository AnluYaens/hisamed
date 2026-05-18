import { Skeleton } from '@/components/ui/skeleton';

// Route-level loading boundary for the patient clinical-notes timeline.
export default function NotasLoading() {
  return (
    <div className="fade-in p-6 sm:p-8 lg:px-10">
      <Skeleton className="mb-4 h-4 w-64" />
      <Skeleton className="mb-6 h-7 w-56" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-[22px]" />
        ))}
      </div>
    </div>
  );
}
