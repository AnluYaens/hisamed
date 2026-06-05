import Image from 'next/image';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  /** Render only the icon mark, no wordmark. */
  iconOnly?: boolean;
  /** Use light text — for placement on the dark sidebar / branding panel. */
  onDark?: boolean;
  /** Size of the icon mark. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const markSizes = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
  lg: 'h-14 w-14',
} as const;

// Pixel dimensions matching markSizes — next/image needs explicit width/height.
const markPx = {
  sm: 32,
  md: 36,
  lg: 56,
} as const;

const textSizes = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-2xl',
} as const;

/** Hisamed brand mark + wordmark. Single source of truth for the logo. */
export function BrandLogo({
  iconOnly = false,
  onDark = false,
  size = 'md',
  className,
}: BrandLogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <Image
        src="/icon.png"
        alt="Hisamed"
        width={markPx[size]}
        height={markPx[size]}
        className={cn('shrink-0', markSizes[size])}
        priority
      />
      {!iconOnly && (
        <span
          className={cn(
            'font-semibold tracking-tight',
            textSizes[size],
            onDark ? 'text-white' : 'text-zinc-900',
          )}
        >
          Hisamed
        </span>
      )}
    </div>
  );
}
