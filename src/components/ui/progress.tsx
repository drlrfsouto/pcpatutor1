import { cn } from '@/lib/utils';

export function Progress({ value, className }: { value: number; className?: string }) {
  const bounded = Math.max(0, Math.min(100, value));
  return <div role="progressbar" aria-valuenow={bounded} aria-valuemin={0} aria-valuemax={100} className={cn('h-2 w-full overflow-hidden rounded-full bg-white/[0.07]', className)}><div className="h-full rounded-full bg-mint transition-[width] duration-500" style={{ width: `${bounded}%` }} /></div>;
}
