import { cn } from '@/lib/utils';

// Lightweight skeleton placeholder. Used by route-level loading.tsx files and
// the global search dialog. A pulsing translucent block that reads on the
// frosted Vision surfaces.
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('animate-pulse rounded-xl bg-slate-900/8', className)}
      {...props}
    />
  );
}
