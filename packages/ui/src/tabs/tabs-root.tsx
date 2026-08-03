'use client';

import { useCallback, useId, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { cn } from '../cn';
import { TabsContext } from './tabs-context';
import type { TabsRootProps } from './types';

export function TabsRoot({
  value: valueProp,
  defaultValue,
  onValueChange,
  className,
  children,
}: TabsRootProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const isControlled = valueProp !== undefined;
  const activeValue = isControlled ? valueProp : uncontrolled;
  const layoutId = useId();

  const setActiveValue = useCallback(
    (next: string) => {
      if (!isControlled) setUncontrolled(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  return (
    <div className={cn('flex min-w-0 flex-col gap-3', className)} data-slot="tabs">
      <MotionConfig reducedMotion="user">
        <TabsContext.Provider value={{ activeValue, setActiveValue, layoutId }}>
          {children}
        </TabsContext.Provider>
      </MotionConfig>
    </div>
  );
}
