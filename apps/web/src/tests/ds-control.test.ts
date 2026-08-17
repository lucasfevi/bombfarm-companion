import { describe, expect, it } from 'vitest';
import { chipRecipe } from '@bombfarm/ui/chip.recipe';
import * as stepper from '@bombfarm/ui/stepper.recipe';

/**
 * Class-string parity guard for the control chrome migrated from
 * `control-chrome.ts` (chips + stepper + rank control + check). Legacy strings
 * captured here as the parity source of truth.
 *
 * `small-warn` is the one deliberate exception to that parity: m2-storybook-ci
 * (T7, SBC-12) lightened its text color because plain `text-warn` on `bg-surface`
 * measured 3.31:1 contrast, below WCAG AA's 4.5:1 floor for this 10px text — see
 * `packages/ui/src/chip.recipe.ts` for the computation.
 */
const chipBase =
  'cursor-pointer rounded-full border px-2.5 py-1 text-xs motion-safe:transition-[border-color,background-color] motion-safe:duration-[120ms]';
const chipSmallBase = 'ml-1.5 cursor-default rounded-full border px-1.5 py-0.5 text-[10px]';

const legacyChip = {
  default: `${chipBase} border-line bg-surface`,
  on: `${chipBase} border-accent bg-[color-mix(in_oklch,var(--accent)_16%,var(--surface))]`,
  small: `${chipSmallBase} border-line bg-surface`,
  'small-warn': `${chipSmallBase} border-warn bg-surface text-[color-mix(in_oklch,var(--warn)_80%,white_20%)]`,
} as const;

describe('chipRecipe parity', () => {
  for (const [variant, expected] of Object.entries(legacyChip)) {
    it(`emits legacy chrome string for chip "${variant}"`, () => {
      expect(chipRecipe({ variant: variant as keyof typeof legacyChip })).toBe(expected);
    });
  }

  it('defaults to the "default" chip variant', () => {
    expect(chipRecipe()).toBe(legacyChip.default);
  });
});

describe('stepper / rank-control / check parity', () => {
  it('preserves stepper class sets', () => {
    expect(stepper.stepperClass).toBe('inline-flex items-center gap-1.5');
    expect(stepper.stepperBtnClass).toBe(
      'size-6 cursor-pointer rounded-sm border border-line bg-bg leading-none hover:border-accent motion-safe:transition-[border-color,background-color] motion-safe:duration-[120ms]',
    );
    expect(stepper.stepperValueClass).toBe(
      'inline-block w-[3ch] text-center font-mono text-xs tabular-nums',
    );
  });

  it('preserves rank-control class sets', () => {
    expect(stepper.rankCtlClass).toBe(
      'inline-flex shrink-0 items-stretch overflow-hidden rounded-sm border border-line bg-surface',
    );
    expect(stepper.rankCtlBtnClass).toBe(
      'w-7 cursor-pointer border-none border-r border-line bg-bg-2 p-0 text-base leading-none text-ink hover:bg-[color-mix(in_oklch,var(--accent)_18%,var(--bg-2))] hover:text-accent disabled:cursor-not-allowed disabled:opacity-35 last:border-r-0 last:border-l last:border-line',
    );
    expect(stepper.rankCtlReadoutClass).toBe(
      'inline-flex items-center gap-px px-1.5 min-w-[3.6rem] py-1 tabular-nums select-none',
    );
    expect(stepper.rankCtlLvClass).toBe(
      'mr-[3px] text-[9px] font-bold tracking-[0.04em] text-muted uppercase',
    );
    expect(stepper.rankCtlValueClass).toBe('font-mono text-[13px] font-bold text-ink');
    expect(stepper.rankCtlMaxClass).toBe('font-mono text-[11px] text-muted');
  });

  it('preserves the check label class', () => {
    expect(stepper.checkClass).toBe('inline-flex items-center gap-1.5 text-xs text-muted');
  });

  it('exposes Num composite chrome classes', () => {
    expect(stepper.numFieldClass).toContain('border-line');
    expect(stepper.numSpinClass).toContain('border-r');
    expect(stepper.numSpinBtnClass).toContain('hover:text-accent');
    expect(stepper.numInputClass).toContain('appearance-none');
  });
});
