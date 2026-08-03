'use client';

import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import { AnimatePresence } from 'motion/react';
import { useTooltipCtx } from './tooltip-context';
import type { TooltipPortalProps } from './types';

export function TooltipPortal({ children, ...props }: TooltipPortalProps) {
  const { open } = useTooltipCtx();
  return (
    <AnimatePresence>
      {open ? (
        <TooltipPrimitive.Portal keepMounted data-slot="tooltip-portal" {...props}>
          {children}
        </TooltipPrimitive.Portal>
      ) : null}
    </AnimatePresence>
  );
}
