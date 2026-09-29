import type { ComponentProps, ReactNode } from 'react';
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import type { HTMLMotionProps, Transition } from 'motion/react';
import type { TooltipTone } from '../tooltip.recipe';

export type TooltipProviderProps = ComponentProps<typeof TooltipPrimitive.Provider>;

export type TooltipRootProps = Omit<ComponentProps<typeof TooltipPrimitive.Root>, 'children'> & {
  children: ReactNode;
};

/**
 * `disabled` is omitted because Base UI already gives that name a different meaning here — it
 * suppresses the tooltip and is deliberately kept off the DOM element, so a caller writing
 * `disabled` on a trigger gets neither an inert control nor `disabled:` styling. Each need has
 * its own route: `render={<button disabled />}` for a genuinely inert control, `aria-disabled`
 * plus a refusal in the handler for one that must stay hoverable, `Tooltip.Root disabled` to
 * silence the tooltip.
 */
export type TooltipTriggerProps = Omit<
  ComponentProps<typeof TooltipPrimitive.Trigger>,
  'disabled'
>;

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
