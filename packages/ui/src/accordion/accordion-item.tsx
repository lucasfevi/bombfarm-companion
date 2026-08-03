import { Accordion as BaseAccordion } from '@base-ui/react/accordion';
import { cn } from '../cn';
import { accordionItemClass } from '../accordion.recipe';
import { AccordionItemValueContext } from './accordion-contexts';
import type { AccordionItemProps } from './types';

export function AccordionItem({ value, disabled, className, children }: AccordionItemProps) {
  return (
    <BaseAccordion.Item value={value} disabled={disabled} className={cn(accordionItemClass, className)}>
      <AccordionItemValueContext.Provider value={value}>{children}</AccordionItemValueContext.Provider>
    </BaseAccordion.Item>
  );
}
