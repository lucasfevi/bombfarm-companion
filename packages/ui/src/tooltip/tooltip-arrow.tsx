'use client';

import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import { cn } from '../cn';
import { tooltipArrowClass } from '../tooltip.recipe';
import type { TooltipArrowProps } from './types';

export function TooltipArrow({ className, ...props }: TooltipArrowProps) {
  return (
    <TooltipPrimitive.Arrow
      data-slot="tooltip-arrow"
      className={cn(tooltipArrowClass, className)}
      {...props}
    />
  );
}
