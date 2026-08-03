'use client';

import { motion } from 'motion/react';
import { cn } from '../cn';
import { useTabsCtx } from './tabs-context';
import { blurTransition } from './tabs-transitions';
import type { TabsPanelProps } from './types';

export function TabsPanel({ value, className, children, style }: TabsPanelProps) {
  const { activeValue } = useTabsCtx();
  const isActive = activeValue === value;

  return (
    <motion.div
      role="tabpanel"
      data-slot="tabs-panel"
      data-state={isActive ? 'active' : 'inactive'}
      inert={!isActive}
      className={cn('min-w-0 outline-none', className)}
      style={{ overflow: 'hidden', ...style }}
      initial={false}
      animate={{
        opacity: isActive ? 1 : 0,
        // No inactive blur — CSS filter paints outside overflow and bleeds into the active stage.
      }}
      transition={blurTransition}
    >
      {children}
    </motion.div>
  );
}
