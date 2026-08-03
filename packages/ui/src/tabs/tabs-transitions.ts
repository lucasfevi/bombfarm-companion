import type { Transition } from 'motion/react';

export const highlightTransition: Transition = { type: 'spring', stiffness: 200, damping: 25 };
export const contentsTransition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 32,
  bounce: 0,
  restDelta: 0.01,
};
export const blurTransition: Transition = { type: 'spring', stiffness: 200, damping: 25 };
