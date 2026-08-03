import { createContext, useContext } from 'react';

type TooltipCtx = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

export const TooltipContext = createContext<TooltipCtx | null>(null);

export function useTooltipCtx(): TooltipCtx {
  const context = useContext(TooltipContext);
  if (!context) throw new Error('Tooltip parts must be used inside Tooltip.Root');
  return context;
}
