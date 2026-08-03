'use client';

import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import { cn } from '../cn';
import { tooltipPositionerClass } from '../tooltip.recipe';
import type { TooltipPositionerProps } from './types';

export function TooltipPositioner({ className, sideOffset = 8, ...props }: TooltipPositionerProps) {
  return (
    <TooltipPrimitive.Positioner
      data-slot="tooltip-positioner"
      className={cn(tooltipPositionerClass, className)}
      sideOffset={sideOffset}
      {...props}
    />
  );
}
