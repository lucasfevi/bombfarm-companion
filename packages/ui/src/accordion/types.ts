import type { ReactNode } from 'react';
import type { AccordionSize, AccordionTone } from '../accordion.recipe';

export type AccordionRootProps = {
  value?: string[];
  defaultValue?: string[];
  multiple?: boolean;
  disabled?: boolean;
  onValueChange?: (value: string[], details: unknown) => void;
  keepMounted?: boolean;
  hiddenUntilFound?: boolean;
  className?: string;
  children: ReactNode;
};

export type AccordionItemProps = {
  value?: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

export type AccordionHeaderProps = { className?: string; children: ReactNode };

export type AccordionTriggerProps = {
  tone?: AccordionTone;
  size?: AccordionSize;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  'aria-label'?: string;
};

export type AccordionPanelProps = {
  className?: string;
  children: ReactNode;
};
