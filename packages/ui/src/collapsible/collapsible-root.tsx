import { useEffect, useState } from 'react';
import { Collapsible as BaseCollapsible } from '@base-ui/react/collapsible';
import { MotionConfig } from 'motion/react';
import { CollapsibleOpenContext } from './collapsible-open-context';
import type { CollapsibleRootProps } from './types';

export function CollapsibleRoot({
  open: openProp,
  defaultOpen,
  onOpenChange,
  disabled,
  className,
  children,
}: CollapsibleRootProps) {
  const [open, setOpen] = useState(openProp ?? defaultOpen ?? false);

  useEffect(() => {
    if (openProp !== undefined) setOpen(openProp);
  }, [openProp]);

  return (
    <BaseCollapsible.Root
      open={openProp}
      defaultOpen={defaultOpen}
      onOpenChange={(next, details) => {
        setOpen(next);
        onOpenChange?.(next, details);
      }}
      disabled={disabled}
      className={className}
    >
      {/* `reducedMotion="user"` makes every nested `motion.*` respect the OS prefers-reduced-motion
          setting automatically (durations collapse to ~0, no manual motion-safe: bookkeeping needed) —
          restores the guarantee the old CSS-transition implementation had via `motion-safe:` classes. */}
      <MotionConfig reducedMotion="user">
        <CollapsibleOpenContext.Provider value={open}>{children}</CollapsibleOpenContext.Provider>
      </MotionConfig>
    </BaseCollapsible.Root>
  );
}
