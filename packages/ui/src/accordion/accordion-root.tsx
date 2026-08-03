import { useEffect, useState } from 'react';
import { Accordion as BaseAccordion } from '@base-ui/react/accordion';
import { MotionConfig } from 'motion/react';
import { AccordionOpenContext } from './accordion-contexts';
import type { AccordionRootProps } from './types';

export function AccordionRoot({
  value: valueProp,
  defaultValue,
  multiple,
  disabled,
  onValueChange,
  keepMounted,
  hiddenUntilFound,
  className,
  children,
}: AccordionRootProps) {
  const [value, setValue] = useState<string[]>(valueProp ?? defaultValue ?? []);

  useEffect(() => {
    if (valueProp !== undefined) setValue(valueProp);
  }, [valueProp]);

  return (
    <BaseAccordion.Root<string>
      value={valueProp}
      defaultValue={defaultValue}
      multiple={multiple}
      disabled={disabled}
      onValueChange={(next, details) => {
        setValue(next);
        onValueChange?.(next, details);
      }}
      keepMounted={keepMounted}
      hiddenUntilFound={hiddenUntilFound}
      className={className}
    >
      {/* See `Collapsible.Root` for why: `reducedMotion="user"` makes every nested `motion.*`
          respect the OS prefers-reduced-motion setting automatically. */}
      <MotionConfig reducedMotion="user">
        <AccordionOpenContext.Provider value={value}>{children}</AccordionOpenContext.Provider>
      </MotionConfig>
    </BaseAccordion.Root>
  );
}
