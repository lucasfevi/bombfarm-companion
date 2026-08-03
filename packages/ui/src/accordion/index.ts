import { AccordionRoot } from './accordion-root';
import { AccordionItem } from './accordion-item';
import { AccordionHeader } from './accordion-header';
import { AccordionTrigger } from './accordion-trigger';
import { AccordionPanel } from './accordion-panel';

export type {
  AccordionRootProps,
  AccordionItemProps,
  AccordionHeaderProps,
  AccordionTriggerProps,
  AccordionPanelProps,
} from './types';

/**
 * Accordion primitive — compound wrap over `@base-ui/react/accordion`
 * (UAC-01). Multi-item disclosure; `multiple` (default `false`) is
 * one-at-a-time. Dressed by `accordionRecipe` (shared with `Collapsible`).
 */
export const Accordion = {
  Root: AccordionRoot,
  Item: AccordionItem,
  Header: AccordionHeader,
  Trigger: AccordionTrigger,
  Panel: AccordionPanel,
};
