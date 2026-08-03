/**
 * Tooltip — adapted from Animate UI Base UI tooltip
 * https://animate-ui.com/docs/components/base/tooltip
 * (Motion spring scale enter/exit via Popup `render` + AnimatePresence Portal).
 * Dressed for planner tokens; compound `Tooltip.Provider/Root/Trigger/…` API.
 */

import { TooltipProvider } from './tooltip-provider';
import { TooltipRoot } from './tooltip-root';
import { TooltipTrigger } from './tooltip-trigger';
import { TooltipPortal } from './tooltip-portal';
import { TooltipPositioner } from './tooltip-positioner';
import { TooltipPopup } from './tooltip-popup';
import { TooltipArrow } from './tooltip-arrow';
import { TooltipStatusBody } from './tooltip-status-body';

export type {
  TooltipProviderProps,
  TooltipRootProps,
  TooltipTriggerProps,
  TooltipPortalProps,
  TooltipPositionerProps,
  TooltipPopupProps,
  TooltipArrowProps,
} from './types';

export { TooltipStatusBody };

/**
 * Tooltip primitive — compound wrap over `@base-ui/react/tooltip` with Animate UI
 * Motion spring enter/exit on the popup.
 */
export const Tooltip = {
  Provider: TooltipProvider,
  Root: TooltipRoot,
  Trigger: TooltipTrigger,
  Portal: TooltipPortal,
  Positioner: TooltipPositioner,
  Popup: TooltipPopup,
  Arrow: TooltipArrow,
  StatusBody: TooltipStatusBody,
};
