import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn('flex min-h-24 w-full resize-y rounded-xl border border-line bg-[#07111f]/70 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-colors focus:border-mint/50 focus:ring-2 focus:ring-mint/10 disabled:cursor-not-allowed disabled:opacity-50', className)} {...props} />;
});
