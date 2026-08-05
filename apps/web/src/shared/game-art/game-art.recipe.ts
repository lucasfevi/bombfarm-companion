import { cva } from 'class-variance-authority';

/** Shared corner radius for wiki-sourced hero/item inventory frames. */
export const artFrameRadiusClass = 'rounded-sm';

const artFrameBase =
  'relative inline-grid shrink-0 place-items-center overflow-hidden border-2 bg-[color-mix(in_oklch,var(--bg)_55%,var(--surface))]';

const artFrameSize = {
  xs: 'size-7',
  sm: 'size-8',
  md: 'size-11',
  lg: 'size-12',
  xl: 'size-16 max-[720px]:size-14',
} as const;

/** Rarity-coloured square frame for hero avatars and item icons. */
export const artFrameRecipe = cva(`${artFrameBase} ${artFrameRadiusClass}`, {
  variants: {
    size: artFrameSize,
    rarity: {
      0: 'border-rar-0',
      1: 'border-rar-1',
      2: 'border-rar-2',
      3: 'border-rar-3',
      4: 'border-rar-4',
      5: 'border-rar-5',
    },
  },
  defaultVariants: { size: 'md', rarity: 2 },
});

/** +N forge badge — legible on busy pixel art; halo on glyphs only, no box chrome. */
export const forgeUpgradeBadgeClass =
  'pointer-events-none absolute right-0.5 bottom-0.5 z-10 bg-transparent font-mono text-[11px] font-bold leading-none tabular-nums text-ink [text-shadow:0_0_1px_var(--bg),0_0_2px_var(--bg),1px_0_0_color-mix(in_oklch,var(--bg)_88%,transparent),-1px_0_0_color-mix(in_oklch,var(--bg)_88%,transparent),0_1px_0_color-mix(in_oklch,var(--bg)_88%,transparent),0_-1px_0_color-mix(in_oklch,var(--bg)_88%,transparent),0_1px_2px_color-mix(in_oklch,var(--bg)_92%,transparent)]';

const abilityIconSize = {
  xs: 'size-5',
  sm: 'size-6',
  md: 'size-8',
  lg: 'size-11',
} as const;

/** Neutral square frame for wiki ability icons (no rarity border). */
export const abilityIconRecipe = cva(
  `${artFrameRadiusClass} relative inline-grid shrink-0 place-items-center overflow-hidden border border-line bg-[color-mix(in_oklch,var(--bg)_55%,var(--surface))]`,
  {
    variants: { size: abilityIconSize },
    defaultVariants: { size: 'xs' },
  },
);

export type AbilityIconRecipeSize = keyof typeof abilityIconSize;
export type ArtFrameRecipeSize = keyof typeof artFrameSize;

/** Literal rarity text colours so Tailwind's JIT scanner sees every class. */
const rarityTextClasses = [
  'text-rar-0',
  'text-rar-1',
  'text-rar-2',
  'text-rar-3',
  'text-rar-4',
  'text-rar-5',
] as const;

/** Literal rarity dot/background colours so Tailwind's JIT scanner sees every class. */
const rarityDotClasses = [
  'bg-rar-0',
  'bg-rar-1',
  'bg-rar-2',
  'bg-rar-3',
  'bg-rar-4',
  'bg-rar-5',
] as const;

/** Rarity index → text colour class. `undefined` for an out-of-range index (matches raw array indexing). */
export function rarityTextClass(index: number): string | undefined {
  return rarityTextClasses[index];
}

/** Rarity index → dot/background colour class. `undefined` for an out-of-range index. */
export function rarityDotClass(index: number): string | undefined {
  return rarityDotClasses[index];
}

/**
 * Roster icon tooltip trigger — real button semantics, hover/pointer only.
 * `tabIndex={-1}` on the trigger keeps one tab stop per picker row (the `<tr>`).
 */
export const rosterIconTooltipTriggerClass =
  'inline-flex cursor-default rounded-sm border-0 bg-transparent p-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:1px]';
