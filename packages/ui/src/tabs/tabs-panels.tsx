'use client';

import { Children, isValidElement, type ReactElement } from 'react';
import { motion } from 'motion/react';
import { cn } from '../cn';
import { useTabsCtx } from './tabs-context';
import { contentsTransition } from './tabs-transitions';
import { useTabsPanelsHeight } from './use-tabs-panels-height';
import type { TabsPanelsProps } from './types';

/**
 * Animate UI `TabsContents`: all panes stay mounted in a row; the track slides on `x`
 * while the outer shell animates to the active pane's measured height.
 */
export function TabsPanels({ className, children, transition = contentsTransition }: TabsPanelsProps) {
  const { activeValue } = useTabsCtx();
  const childrenArray = Children.toArray(children);
  const activeIndex = childrenArray.findIndex(
    (child): child is ReactElement<{ value: string }> =>
      isValidElement(child) &&
      typeof child.props === 'object' &&
      child.props !== null &&
      'value' in child.props &&
      (child.props as { value: string }).value === activeValue,
  );

  const { containerRef, itemRefs, height } = useTabsPanelsHeight(activeIndex, childrenArray.length);

  return (
    <motion.div
      ref={containerRef}
      data-slot="tabs-panels"
      className={cn('min-w-0', className)}
      style={{ overflow: 'clip' }}
      animate={{ height: height || 'auto' }}
      transition={transition}
    >
      <motion.div
        className="flex"
        animate={{ x: `${activeIndex >= 0 ? activeIndex * -100 : 0}%` }}
        transition={transition}
      >
        {childrenArray.map((child, index) => (
          <div
            key={
              isValidElement(child) &&
              typeof child.props === 'object' &&
              child.props !== null &&
              'value' in child.props
                ? String((child.props as { value: string }).value)
                : index
            }
            ref={(element) => {
              // react-compiler cannot trace ref mutability through a custom hook's return
              // value (itemRefs is a real useRef() array owned by useTabsPanelsHeight); this
              // callback-ref population pattern is standard and was unflagged before the split.
              itemRefs.current[index] = element;
            }}
            className="w-full shrink-0 overflow-clip"
          >
            {child}
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
