'use client';

import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../cn';
import { Tooltip } from '../tooltip';
import { useTabsCtx } from './tabs-context';
import { highlightTransition } from './tabs-transitions';
import type { TabsTabProps } from './types';

export function TabsTab({
  value,
  className,
  children,
  badge = null,
  badgeLabel = null,
  status = null,
  'aria-label': ariaLabel,
}: TabsTabProps) {
  const { activeValue, setActiveValue, layoutId } = useTabsCtx();
  const selected = activeValue === value;
  const statusLabel = badgeLabel?.trim() || null;
  const showStatusTip = Boolean(badge && status && status.issues.length > 0);
  const tipTone = badge === 'warn' ? 'warn' : 'soft';

  const tabClassName = cn(
    'relative inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-bold tracking-[0.04em] uppercase',
    'text-muted outline-none transition-colors',
    'hover:text-ink focus-visible:text-ink',
    selected && 'text-accent',
    className,
  );

  const tabInner = (
    <>
      <AnimatePresence>
        {selected && (
          <motion.span
            layoutId={`${layoutId}-highlight`}
            data-slot="tabs-highlight"
            className="absolute inset-x-0 inset-y-0.5 -z-10 rounded-sm bg-[color-mix(in_oklch,var(--accent)_14%,transparent)]"
            transition={highlightTransition}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>
      <span className="relative z-10 inline-flex items-center gap-1.5">
        {children}
        {badge === 'warn' && (
          <span
            data-tab-badge="warn"
            className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-[0.06em] text-warn normal-case"
          >
            <span className="size-1.5 shrink-0 rounded-full bg-warn" aria-hidden />
            {statusLabel}
          </span>
        )}
        {badge === 'soft' && (
          <span
            data-tab-badge="soft"
            className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-[0.06em] text-accent normal-case opacity-90"
          >
            <span className="size-1.5 shrink-0 rounded-full bg-accent opacity-70" aria-hidden />
            {statusLabel}
          </span>
        )}
      </span>
      {selected && (
        <motion.span
          layoutId={`${layoutId}-underline`}
          className="absolute inset-x-1 -bottom-px h-0.5 bg-accent"
          transition={highlightTransition}
        />
      )}
    </>
  );

  if (!showStatusTip || !status) {
    return (
      <button
        type="button"
        role="tab"
        data-slot="tabs-trigger"
        data-state={selected ? 'active' : 'inactive'}
        aria-selected={selected}
        aria-label={ariaLabel}
        tabIndex={selected ? 0 : -1}
        onClick={() => setActiveValue(value)}
        className={tabClassName}
      >
        {tabInner}
      </button>
    );
  }

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <button
            type="button"
            role="tab"
            data-slot="tabs-trigger"
            data-state={selected ? 'active' : 'inactive'}
            aria-selected={selected}
            aria-label={ariaLabel}
            tabIndex={selected ? 0 : -1}
            onClick={() => setActiveValue(value)}
            className={tabClassName}
          />
        }
      >
        {tabInner}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner side="bottom" align="start">
          <Tooltip.Popup tone={tipTone === 'warn' ? 'warn' : 'soft'}>
            <Tooltip.StatusBody title={status.title} issues={status.issues} tone={tipTone} />
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
