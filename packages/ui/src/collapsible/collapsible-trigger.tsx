import { Collapsible as BaseCollapsible } from '@base-ui/react/collapsible';
import { HiMiniChevronDown } from 'react-icons/hi2';
import { cn } from '../cn';
import { accordionIconClass, accordionRecipe } from '../accordion.recipe';
import type { CollapsibleTriggerProps } from './types';

/** `<button>` trigger — shares `accordionRecipe` + chevron placement with `Accordion.Trigger`. */
export function CollapsibleTrigger({
  tone = 'section',
  size = 'default',
  disabled,
  className,
  children,
  'aria-label': ariaLabel,
}: CollapsibleTriggerProps) {
  const icon = <HiMiniChevronDown data-accordion-icon className={accordionIconClass} aria-hidden />;
  return (
    <BaseCollapsible.Trigger
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(accordionRecipe({ tone, size }), className)}
    >
      {tone === 'row' || tone === 'panel' ? (
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
    </BaseCollapsible.Trigger>
  );
}
