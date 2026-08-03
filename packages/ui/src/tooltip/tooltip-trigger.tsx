'use client';

import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import type { TooltipTriggerProps } from './types';

export function TooltipTrigger(props: TooltipTriggerProps) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}
