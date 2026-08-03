import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Ability-card variant table — replaces the hand-rolled `abilCardClassName`
 * if/else resolver with cva `compoundVariants` for `onSheet × selected`. The
 * `lockedOut` muted class is appended last to preserve the exact class-string
 * order the legacy resolver produced (`abilClass <state> abilMuted`).
 */
const abilClass = 'flex h-full min-w-0 flex-col gap-2 rounded-sm border border-line bg-bg p-2.5';
const abilOnClass =
  'border-[color-mix(in_oklch,var(--accent)_45%,var(--line))] bg-[color-mix(in_oklch,var(--accent)_7%,var(--bg))]';
const abilSheetClass = 'border-[color-mix(in_oklch,var(--up)_35%,var(--line))]';
const abilSheetOnClass =
  'border-[color-mix(in_oklch,var(--up)_50%,var(--line))] bg-[color-mix(in_oklch,var(--up)_8%,var(--bg))]';
const abilMutedClass = 'opacity-[0.42]';

const abilityCard = cva(abilClass, {
  variants: {
    selected: { true: '', false: '' },
    onSheet: { true: '', false: '' },
  },
  compoundVariants: [
    { onSheet: true, selected: true, class: abilSheetOnClass },
    { onSheet: true, selected: false, class: abilSheetClass },
    { onSheet: false, selected: true, class: abilOnClass },
  ],
  defaultVariants: { selected: false, onSheet: false },
});

export function abilityCardRecipe(options: {
  selected: boolean;
  onSheet: boolean;
  lockedOut: boolean;
}): string {
  const base = abilityCard({ selected: options.selected, onSheet: options.onSheet });
  return options.lockedOut ? `${base} ${abilMutedClass}` : base;
}

/** Ability chip (selected list) — sheet-ability accent vs default accent. */
export const abilityChipRecipe = cva('', {
  variants: {
    sheet: {
      true: 'inline-flex cursor-help items-center gap-1 rounded-sm border border-[color-mix(in_oklch,var(--up)_45%,var(--line))] bg-surface px-2 py-[3px] text-xs [&_b]:font-mono [&_b]:text-[11px] [&_b]:text-up',
      false:
        'inline-flex cursor-help items-center gap-1 rounded-sm border border-[color-mix(in_oklch,var(--accent)_40%,var(--line))] bg-surface px-2 py-[3px] text-xs [&_b]:font-mono [&_b]:text-[11px] [&_b]:text-accent',
    },
  },
  defaultVariants: { sheet: false },
});

export type AbilityChipVariant = VariantProps<typeof abilityChipRecipe>;

/** Fixed ability layout bundles (no variants) — documented recipe constants (DS-05). */
export const abilGridClass =
  'grid grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-2';
export const abilSelectedClass =
  'mb-2.5 flex flex-wrap items-center gap-1.5 rounded-sm border border-line bg-bg-2 p-2';
export const abilSelectedLabelClass =
  'mr-0.5 text-[10px] font-bold tracking-[0.04em] text-muted uppercase';
export const abilMetaClass = 'flex min-h-0 min-w-0 flex-1 flex-col gap-[3px]';
/** Icon rail + text — grid keeps copy aligned when icons scale up. */
export const abilHeadClass = 'grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2.5 gap-y-1';
export const abilNameClass =
  'flex flex-wrap items-center gap-1.5 text-[13px] leading-[1.25] font-semibold text-ink';
export const abilTagClass =
  'rounded-sm border border-[color-mix(in_oklch,var(--up)_30%,transparent)] bg-[color-mix(in_oklch,var(--up)_14%,transparent)] px-[5px] py-0.5 text-[9px] font-bold tracking-[0.05em] text-up not-italic uppercase';
export const abilEffectClass = 'line-clamp-2 text-[11px] leading-[1.3] text-muted';
