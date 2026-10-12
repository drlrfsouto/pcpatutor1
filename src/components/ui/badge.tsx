import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-medium leading-tight transition-colors', {
  variants: {
    variant: {
      default: 'border-mint/20 bg-mint/10 text-mint',
      secondary: 'border-line bg-white/[0.055] text-slate-300',
      outline: 'border-line bg-transparent text-slate-300',
      destructive: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
    },
  },
  defaultVariants: { variant: 'default' },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
