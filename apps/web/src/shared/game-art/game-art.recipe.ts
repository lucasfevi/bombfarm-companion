import { cva } from 'class-variance-authority';

/** Shared corner radius for wiki-sourced hero/item inventory frames. */
export const artFrameRadiusClass = 'rounded-sm';

const artFrameBase =
  'relative z-0 isolate inline-grid shrink-0 place-items-center overflow-hidden border-2';

const artFrameSize = {
  xs: 'w-7',
  sm: 'w-8',
  md: 'w-11',
  lg: 'w-12',
  xl: 'w-16 max-[720px]:w-14',
} as const;

/** Rarity-coloured frame for hero avatars (square) and item icons (portrait). */
export const artFrameRecipe = cva(`${artFrameBase} ${artFrameRadiusClass}`, {
  variants: {
    size: artFrameSize,
    shape: {
      square: 'aspect-square',
      portrait: 'aspect-[18/19]',
    },
    fill: {
      neutral: 'bg-[color-mix(in_oklch,var(--bg)_55%,var(--surface))]',
      rarity: '',
    },
    rarity: {
      0: 'border-rar-0',
      1: 'border-rar-1',
      2: 'border-rar-2',
      3: 'border-rar-3',
      4: 'border-rar-4',
      5: 'border-rar-5',
    },
  },
  compoundVariants: [
    {
      fill: 'rarity',
      rarity: 0,
      class:
        'bg-[color:var(--rar-slot-0-edge)] bg-[image:radial-gradient(90%_75%_at_50%_38%,var(--rar-slot-0-glow)_0%,transparent_58%),radial-gradient(120%_110%_at_50%_55%,var(--rar-slot-0-mid)_0%,var(--rar-slot-0-edge)_100%)]',
    },
    {
      fill: 'rarity',
      rarity: 1,
      class:
        'bg-[color:var(--rar-slot-1-edge)] bg-[image:radial-gradient(90%_75%_at_50%_38%,var(--rar-slot-1-glow)_0%,transparent_58%),radial-gradient(120%_110%_at_50%_55%,var(--rar-slot-1-mid)_0%,var(--rar-slot-1-edge)_100%)]',
    },
    {
      fill: 'rarity',
      rarity: 2,
      class:
        'bg-[color:var(--rar-slot-2-edge)] bg-[image:radial-gradient(90%_75%_at_50%_38%,var(--rar-slot-2-glow)_0%,transparent_58%),radial-gradient(120%_110%_at_50%_55%,var(--rar-slot-2-mid)_0%,var(--rar-slot-2-edge)_100%)]',
    },
    {
      fill: 'rarity',
      rarity: 3,
      class:
        'bg-[color:var(--rar-slot-3-edge)] bg-[image:radial-gradient(90%_75%_at_50%_38%,var(--rar-slot-3-glow)_0%,transparent_58%),radial-gradient(120%_110%_at_50%_55%,var(--rar-slot-3-mid)_0%,var(--rar-slot-3-edge)_100%)]',
    },
    {
      fill: 'rarity',
      rarity: 4,
      class:
        'bg-[color:var(--rar-slot-4-edge)] bg-[image:linear-gradient(90deg,transparent_18%,color-mix(in_oklch,var(--rar-slot-4-glow)_22%,transparent)_20%,transparent_23%,transparent_48%,color-mix(in_oklch,var(--rar-slot-4-glow)_18%,transparent)_50%,transparent_53%,transparent_76%,color-mix(in_oklch,var(--rar-slot-4-glow)_16%,transparent)_78%,transparent_81%),radial-gradient(80%_65%_at_50%_40%,var(--rar-slot-4-glow)_0%,transparent_60%),radial-gradient(120%_110%_at_50%_55%,var(--rar-slot-4-mid)_0%,var(--rar-slot-4-edge)_100%)]',
    },
    {
      fill: 'rarity',
      rarity: 5,
      class:
        'bg-[color:var(--rar-slot-5-edge)] bg-[image:radial-gradient(90%_75%_at_50%_38%,var(--rar-slot-5-glow)_0%,transparent_58%),radial-gradient(120%_110%_at_50%_55%,var(--rar-slot-5-mid)_0%,var(--rar-slot-5-edge)_100%)]',
    },
  ],
  defaultVariants: { size: 'md', shape: 'square', fill: 'neutral', rarity: 2 },
});

const iconMetaGlyphBase =
  'pointer-events-none absolute z-[1] font-bold leading-none tabular-nums tracking-tight [text-shadow:0_1px_1px_color-mix(in_oklch,var(--bg)_90%,transparent),0_0_4px_color-mix(in_oklch,var(--bg)_72%,transparent)]';

/** Halo glyphs on inventory art — no plaque fill. */
export const iconMetaGlyphRecipe = cva(iconMetaGlyphBase, {
  variants: {
    size: {
      compact: 'text-[10px]',
      roomy: 'text-[11px]',
    },
    place: {
      'top-end': 'top-0.5 right-0.5 text-ink',
      'bottom-end': 'bottom-0.5 right-0.5 text-[color-mix(in_oklch,var(--ink)_72%,var(--rar-4))]',
      'bottom-center': 'inset-x-0 bottom-0.5 text-center text-ink',
    },
  },
  defaultVariants: { size: 'compact', place: 'top-end' },
});

export type IconMetaGlyphSize = 'compact' | 'roomy';

const abilityIconSize = {
  xs: 'size-7',
  sm: 'size-8',
  md: 'size-11',
  lg: 'size-12',
  xl: 'size-16 max-[720px]:size-14',
} as const;

/** Neutral square frame for wiki ability icons (no rarity border). */
export const abilityIconRecipe = cva(
  `${artFrameRadiusClass} relative z-0 isolate inline-grid shrink-0 place-items-center overflow-hidden border border-line bg-[color-mix(in_oklch,var(--bg)_55%,var(--surface))]`,
  {
    variants: { size: abilityIconSize },
    defaultVariants: { size: 'md' },
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

/** Shelved-hero mute — apply to scan chrome, not the status toggle. */
export const rosterInactiveChromeClass = 'opacity-55 grayscale';
