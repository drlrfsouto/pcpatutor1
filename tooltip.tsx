import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;
export const TooltipContent = React.forwardRef<React.ElementRef<typeof TooltipPrimitive.Content>, React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>>(function TooltipContent({ className, sideOffset = 6, ...props }, ref) {
  return <TooltipPrimitive.Portal><TooltipPrimitive.Content ref={ref} sideOffset={sideOffset} className={cn('z-50 rounded-xl border border-line bg-[#101e2e] px-3 py-2 text-sm text-slate-100 shadow-xl outline-none', className)} {...props} /></TooltipPrimitive.Portal>;
});
