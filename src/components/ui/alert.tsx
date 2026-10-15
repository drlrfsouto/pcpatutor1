import * as React from 'react';
import { cn } from '@/lib/utils';

export function Alert({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="alert" className={cn('relative w-full rounded-lg border border-cyan-400/10 bg-cyan-400/[0.025] px-3 py-2.5 text-xs text-slate-300', className)} {...props} />;
}
export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn('mb-0.5 text-xs font-semibold leading-5 tracking-tight', className)} {...props} />;
}
export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn('text-xs leading-5 text-slate-500 [&_p]:leading-5', className)} {...props} />;
}
