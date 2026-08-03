import { Accordion as BaseAccordion } from '@base-ui/react/accordion';
import { HiMiniChevronDown } from 'react-icons/hi2';
import { cn } from '../cn';
import { accordionIconClass, accordionRecipe } from '../accordion.recipe';
import type { AccordionTriggerProps } from './types';

/** `<button>` trigger — injects the fixed-size rotating chevron leading (`tone: 'section'`) or trailing (`tone: 'row'`). */
export function AccordionTrigger({
  tone = 'section',
  size = 'default',
  disabled,
  className,
  children,
  'aria-label': ariaLabel,
}: AccordionTriggerProps) {
  const icon = <HiMiniChevronDown data-accordion-icon className={accordionIconClass} aria-hidden />;
  return (
    <BaseAccordion.Trigger
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(accordionRecipe({ tone, size }), className)}
    >
      {tone === 'row' ? (
        <>
          {children}
          {icon}
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </BaseAccordion.Trigger>
  );
}
