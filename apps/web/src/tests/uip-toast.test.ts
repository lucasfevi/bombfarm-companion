import { describe, expect, it } from 'vitest';
import { toastClass } from '@bombfarm/ui/toast.recipe';

/** Frozen source-of-truth from former `src/components/chrome/toast.tsx`. */
const legacyToastClass =
  'fixed right-4 bottom-4 z-50 rounded-sm bg-accent px-3.5 py-2.5 text-[13px] font-semibold text-accent-ink shadow-[0_8px_24px_color-mix(in_oklch,var(--ink)_18%,transparent)] animate-toast-in';

describe('toastClass parity', () => {
  it('matches legacy app-shell toast class bundle', () => {
    expect(toastClass).toBe(legacyToastClass);
  });
});
