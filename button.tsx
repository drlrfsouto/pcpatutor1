import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/60 disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-mint text-ink hover:bg-[#84f4d0] shadow-[0_8px_24px_rgba(104,240,194,0.13)]',
        secondary: 'border border-line bg-white/[0.045] text-slate-100 hover:bg-white/[0.09]',
        outline: 'border border-line text-slate-200 hover:bg-white/[0.06]',
        ghost: 'text-slate-300 hover:bg-white/[0.07] hover:text-white',
        destructive: 'bg-rose-500/15 text-rose-200 border border-rose-400/20 hover:bg-rose-500/25',
        link: 'text-mint underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-lg px-3 text-xs',
        lg: 'h-12 rounded-xl px-5 text-sm',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant, size, ...props }, ref) {
  return <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
});
