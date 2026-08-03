import { Collapsible as BaseCollapsible } from '@base-ui/react/collapsible';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../cn';
import { maskRevealStyle } from '../mask-reveal';
import { useCollapsibleOpen } from './collapsible-open-context';
import type { CollapsiblePanelProps } from './types';

/**
 * Height + opacity + mask-reveal animation via Motion (`motion/react`), adapted from Animate
 * UI's Base UI collapsible primitive (animate-ui.com/docs/primitives/base/collapsible) — the
 * soft mask-gradient edge plus a small slide-up is what makes this read as smoother than a
 * plain height/opacity CSS transition; a flat `overflow: hidden` clip always leaves a hard
 * edge no matter how the duration/easing is tuned.
 *
 * `AnimatePresence` plays the exit animation before the panel actually unmounts. `keepMounted`
 * + explicit `hidden={false}` override Base UI's own default hidden-attribute/unmount timing,
 * which is normally driven by detecting a real CSS transition on the element — Motion animates
 * via the Web Animations API instead, so Base UI would otherwise apply `hidden` (`display:
 * none`) the instant `open` flips, before Motion's exit animation gets a chance to play.
 */
export function CollapsiblePanel({ className, children }: CollapsiblePanelProps) {
  const open = useCollapsibleOpen();
  return (
    <AnimatePresence>
      {open && (
        <BaseCollapsible.Panel
          hidden={false}
          keepMounted
          render={
            <motion.div
              key="panel"
              className={cn('overflow-hidden', className)}
              initial={{ height: 0, opacity: 0, '--mask-stop': '0%', y: 12 }}
              animate={{ height: 'auto', opacity: 1, '--mask-stop': '100%', y: 0 }}
              exit={{ height: 0, opacity: 0, '--mask-stop': '0%', y: 12 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              style={maskRevealStyle}
            />
          }
        >
          {children}
        </BaseCollapsible.Panel>
      )}
    </AnimatePresence>
  );
}
