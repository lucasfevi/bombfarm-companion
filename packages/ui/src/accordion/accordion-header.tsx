import { Accordion as BaseAccordion } from '@base-ui/react/accordion';
import type { AccordionHeaderProps } from './types';

export function AccordionHeader({ className, children }: AccordionHeaderProps) {
  return <BaseAccordion.Header className={className}>{children}</BaseAccordion.Header>;
}
