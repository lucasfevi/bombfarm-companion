import type { MotionStyle } from 'motion/react';

/**
 * Soft edge reveal animation style for collapsible/accordion panels.
 * Uses `mask-image` driven by an animated `--mask-stop` custom property —
 * content fades out right at the growing/shrinking edge instead of being
 * hard-clipped by `overflow: hidden`.
 *
 * See `docs/animation.md` rule 2 for the full rationale.
 */
export const maskRevealStyle: MotionStyle = {
  maskImage: 'linear-gradient(black var(--mask-stop), transparent var(--mask-stop))',
  WebkitMaskImage: 'linear-gradient(black var(--mask-stop), transparent var(--mask-stop))',
};
