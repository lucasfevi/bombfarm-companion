import type { ComponentProps, ReactNode } from 'react';
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import type { HTMLMotionProps, Transition } from 'motion/react';
import type { TooltipTone } from '../tooltip.recipe';

export type TooltipProviderProps = ComponentProps<typeof TooltipPrimitive.Provider>;

export type TooltipRootProps = Omit<ComponentProps<typeof TooltipPrimitive.Root>, 'children'> & {
  children: ReactNode;
};

export type TooltipTriggerProps = ComponentProps<typeof TooltipPrimitive.Trigger>;

export type TooltipPortalProps = Omit<
  ComponentProps<typeof TooltipPrimitive.Portal>,
  'keepMounted' | 'children'
> & {
  children: ReactNode;
};

export type TooltipPositionerProps = ComponentProps<typeof TooltipPrimitive.Positioner>;

export type TooltipPopupProps = Omit<ComponentProps<typeof TooltipPrimitive.Popup>, 'render'> &
  HTMLMotionProps<'div'> & {
    tone?: TooltipTone;
    transition?: Transition;
  };

export type TooltipArrowProps = ComponentProps<typeof TooltipPrimitive.Arrow>;
