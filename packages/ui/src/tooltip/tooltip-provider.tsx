'use client';

import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import type { TooltipProviderProps } from './types';

export function TooltipProvider({ delay = 200, closeDelay = 80, ...props }: TooltipProviderProps) {
  return <TooltipPrimitive.Provider delay={delay} closeDelay={closeDelay} {...props} />;
}
