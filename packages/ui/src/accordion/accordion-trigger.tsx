import { Accordion as BaseAccordion } from '@base-ui/react/accordion';
import { cn } from '../cn';
import { Icon } from '../icon';
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
  const icon = (
    <Icon name="chevron-down" data-accordion-icon className={accordionIconClass} />
  );
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
