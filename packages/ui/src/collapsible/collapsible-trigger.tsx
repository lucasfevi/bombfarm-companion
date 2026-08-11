import { Collapsible as BaseCollapsible } from '@base-ui/react/collapsible';
import { cn } from '../cn';
import { Icon } from '../icon';
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
  const icon = (
    <Icon name="chevron-down" data-accordion-icon className={accordionIconClass} />
  );
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
