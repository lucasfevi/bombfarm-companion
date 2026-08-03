import { useContext } from 'react';
import { Accordion as BaseAccordion } from '@base-ui/react/accordion';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../cn';
import { maskRevealStyle } from '../mask-reveal';
import { AccordionOpenContext, AccordionItemValueContext } from './accordion-contexts';
import type { AccordionPanelProps } from './types';

/**
 * Height + opacity + mask-reveal animation via Motion — see `Collapsible.Panel` for the full
 * rationale (adapted from animate-ui.com/docs/primitives/base/accordion). Slightly faster than
 * `Collapsible.Panel` since this is a smaller nested ledger row, not the main card reveal.
 */
export function AccordionPanel({ className, children }: AccordionPanelProps) {
  const openValues = useContext(AccordionOpenContext);
  const itemValue = useContext(AccordionItemValueContext);
  const open = itemValue !== undefined && openValues.includes(itemValue);
  return (
    <AnimatePresence>
      {open && (
        <BaseAccordion.Panel
          hidden={false}
          keepMounted
          render={
            <motion.div
              key="panel"
              className={cn('overflow-hidden', className)}
              initial={{ height: 0, opacity: 0, '--mask-stop': '0%', y: 8 }}
              animate={{ height: 'auto', opacity: 1, '--mask-stop': '100%', y: 0 }}
              exit={{ height: 0, opacity: 0, '--mask-stop': '0%', y: 8 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
              style={maskRevealStyle}
            />
          }
        >
          {children}
        </BaseAccordion.Panel>
      )}
    </AnimatePresence>
  );
}
