'use client';

import { useCallback, useState } from 'react';
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import { MotionConfig } from 'motion/react';
import { TooltipContext } from './tooltip-context';
import type { TooltipRootProps } from './types';

export function TooltipRoot({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
  ...props
}: TooltipRootProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? Boolean(openProp) : uncontrolled;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolled(next);
    },
    [isControlled],
  );

  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <MotionConfig reducedMotion="user">
        <TooltipPrimitive.Root
          data-slot="tooltip"
          open={open}
          onOpenChange={(next, eventDetails) => {
            if (!isControlled) setUncontrolled(next);
            onOpenChange?.(next, eventDetails);
          }}
          {...props}
        >
          {children}
        </TooltipPrimitive.Root>
      </MotionConfig>
    </TooltipContext.Provider>
  );
}
