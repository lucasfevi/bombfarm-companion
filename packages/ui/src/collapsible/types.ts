import type { ReactNode } from 'react';
import type { AccordionSize, AccordionTone } from '../accordion.recipe';

export type CollapsibleRootProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: unknown) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

export type CollapsibleTriggerProps = {
  tone?: AccordionTone;
  size?: AccordionSize;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  'aria-label'?: string;
};

export type CollapsiblePanelProps = {
  className?: string;
  children: ReactNode;
};
