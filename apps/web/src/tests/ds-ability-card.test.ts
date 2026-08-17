import { describe, expect, it } from 'vitest';
import {
  abilityCardRecipe,
  abilityChipRecipe,
} from '@bombfarm/ui/ability-card.recipe';

/**
 * Equality guard: `abilityCardRecipe` must produce byte-for-byte the same
 * class string the deleted `abilCardClassName` resolver produced, for every
 * `onSheet × selected` combination and both `lockedOut` states. The legacy
 * resolver is reproduced here as the source of truth.
 *
 * `abilMutedClass` is the one deliberate exception to that parity: m2-storybook-ci
 * (T7, SBC-12) raised it from `opacity-[0.42]` to `opacity-[0.55]` because the
 * locked-out card text measured 3.54:1 contrast against WCAG AA's 4.5:1 floor —
 * see `packages/ui/src/ability-card.recipe.ts` for the computation.
 */
const abilClass = 'flex h-full min-w-0 flex-col gap-2 rounded-sm border border-line bg-bg p-2.5';
const abilOnClass =
  'border-[color-mix(in_oklch,var(--accent)_45%,var(--line))] bg-[color-mix(in_oklch,var(--accent)_7%,var(--bg))]';
const abilSheetClass = 'border-[color-mix(in_oklch,var(--up)_35%,var(--line))]';
const abilSheetOnClass =
  'border-[color-mix(in_oklch,var(--up)_50%,var(--line))] bg-[color-mix(in_oklch,var(--up)_8%,var(--bg))]';
const abilMutedClass = 'opacity-[0.55]';

function legacyAbilCardClassName(opts: {
  selected: boolean;
  onSheet: boolean;
  lockedOut: boolean;
}): string {
  const parts = [abilClass];
  if (opts.onSheet && opts.selected) parts.push(abilSheetOnClass);
  else if (opts.onSheet) parts.push(abilSheetClass);
  else if (opts.selected) parts.push(abilOnClass);
  if (opts.lockedOut) parts.push(abilMutedClass);
  return parts.join(' ');
}

describe('abilityCardRecipe equality with legacy abilCardClassName', () => {
  for (const onSheet of [false, true]) {
    for (const selected of [false, true]) {
      for (const lockedOut of [false, true]) {
        it(`matches for onSheet=${onSheet} selected=${selected} lockedOut=${lockedOut}`, () => {
          const opts = { onSheet, selected, lockedOut };
          expect(abilityCardRecipe(opts)).toBe(legacyAbilCardClassName(opts));
        });
      }
    }
  }
});

describe('abilityChipRecipe parity', () => {
  it('emits the default (accent) ability-chip chrome', () => {
    expect(abilityChipRecipe({ sheet: false })).toBe(
      'inline-flex cursor-help items-center gap-1 rounded-sm border border-[color-mix(in_oklch,var(--accent)_40%,var(--line))] bg-surface px-2 py-[3px] text-xs [&_b]:font-mono [&_b]:text-[11px] [&_b]:text-accent',
    );
  });

  it('emits the sheet (up) ability-chip chrome', () => {
    expect(abilityChipRecipe({ sheet: true })).toBe(
      'inline-flex cursor-help items-center gap-1 rounded-sm border border-[color-mix(in_oklch,var(--up)_45%,var(--line))] bg-surface px-2 py-[3px] text-xs [&_b]:font-mono [&_b]:text-[11px] [&_b]:text-up',
    );
  });
});
