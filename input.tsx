import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input({ className, type, ...props }, ref) {
  return <input ref={ref} type={type} className={cn('flex h-10 w-full rounded-xl border border-line bg-[#07111f]/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-colors focus:border-mint/50 focus:ring-2 focus:ring-mint/10 disabled:cursor-not-allowed disabled:opacity-50', className)} {...props} />;
});
