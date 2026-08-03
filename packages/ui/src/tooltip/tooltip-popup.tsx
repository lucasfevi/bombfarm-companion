'use client';

import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import { motion, type Transition } from 'motion/react';
import { cn } from '../cn';
import { tooltipPopupRecipe } from '../tooltip.recipe';
import type { TooltipPopupProps } from './types';

const defaultPopupTransition: Transition = { type: 'spring', stiffness: 300, damping: 25 };

export function TooltipPopup({
  className,
  tone = 'default',
  transition = defaultPopupTransition,
  style,
  children,
  ...props
}: TooltipPopupProps) {
  return (
    <TooltipPrimitive.Popup
      data-slot="tooltip-popup"
      render={
        <motion.div
          key="tooltip-popup"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={transition}
          style={style}
        />
      }
      className={cn(tooltipPopupRecipe({ tone }), className)}
      {...props}
    >
      {children}
    </TooltipPrimitive.Popup>
  );
}
