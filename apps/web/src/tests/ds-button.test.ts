import { describe, expect, it } from 'vitest';
import { buttonRecipe } from '@bombfarm/ui/button.recipe';

/**
 * Class-string parity guard: each Button variant must reproduce the exact
 * class string the former `button-chrome.ts` export emitted (captured here as
 * the parity source of truth). Mirrors the `slot-compare-chrome.test.ts` style.
 */
const btnBase =
  'cursor-pointer rounded-sm border px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 motion-safe:transition-[border-color,background-color] motion-safe:duration-[120ms] motion-safe:ease-out';

const legacy = {
  default: `${btnBase} border-line bg-bg-2 hover:border-accent`,
  primary: `${btnBase} border-accent bg-accent text-accent-ink hover:border-accent`,
  ghost: `${btnBase} border-line bg-transparent hover:border-accent`,
  help: `${btnBase} min-w-[30px] rounded-full border-line bg-bg-2 px-0 py-1.5 text-center font-bold hover:border-accent`,
  'help-on': `${btnBase} min-w-[30px] rounded-full border-accent bg-bg-2 px-0 py-1.5 text-center font-bold text-accent hover:border-accent`,
  text: 'cursor-pointer border-0 bg-transparent p-0 text-[11px] tracking-[0.04em] text-muted uppercase hover:text-accent',
  icon: 'inline-grid size-5 shrink-0 cursor-pointer place-items-center rounded-sm border-0 bg-transparent p-0 text-muted hover:bg-[color-mix(in_oklch,var(--down)_12%,transparent)] hover:text-down',
  coffee: 'btn coffee',
  'coffee-full': 'btn coffee full',
} as const;

describe('buttonRecipe parity', () => {
  for (const [variant, expected] of Object.entries(legacy)) {
    it(`emits legacy chrome string for variant "${variant}"`, () => {
      expect(buttonRecipe({ variant: variant as keyof typeof legacy })).toBe(expected);
    });
  }

  it('defaults to the "default" variant when none is given', () => {
    expect(buttonRecipe()).toBe(legacy.default);
  });
});
