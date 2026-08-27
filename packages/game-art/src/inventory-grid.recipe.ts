import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Rarity is the card's chrome, matching the game's own inventory plates: the border carries the
 * rarity hue muted into the panel line so a wall of `comum` gear stays quiet, and the fill is a
 * few percent of the same hue. Equipped state is NOT a colour here — it is the "equipped by" line
 * in the card body, because on a played account nearly every item is equipped and colouring them
 * all leaves the grid one flat tone.
 *
 * `in oklab`, not the repo's usual `in oklch`: polar mixing walks the shorter arc of the hue
 * circle, and `--line`'s hue 48 to `--rar-2`'s blue is shorter going backwards through magenta.
 * That painted the rare tier pink and the epic tier red. Oklab is rectangular and stays on the
 * line between the two colours.
 */
export const inventoryCardRecipe = cva(
  'flex items-start gap-2.5 rounded-lg border p-2.5 text-left motion-safe:transition-[border-color,background-color] motion-safe:duration-[120ms]',
  {
    variants: {
      tone: {
        'rarity-0':
          'border-[color-mix(in_oklab,var(--rar-0)_38%,var(--line))] bg-[color-mix(in_oklab,var(--rar-0)_5%,var(--surface))]',
        'rarity-1':
          'border-[color-mix(in_oklab,var(--rar-1)_38%,var(--line))] bg-[color-mix(in_oklab,var(--rar-1)_5%,var(--surface))]',
        'rarity-2':
          'border-[color-mix(in_oklab,var(--rar-2)_38%,var(--line))] bg-[color-mix(in_oklab,var(--rar-2)_5%,var(--surface))]',
        'rarity-3':
          'border-[color-mix(in_oklab,var(--rar-3)_38%,var(--line))] bg-[color-mix(in_oklab,var(--rar-3)_5%,var(--surface))]',
        'rarity-4':
          'border-[color-mix(in_oklab,var(--rar-4)_38%,var(--line))] bg-[color-mix(in_oklab,var(--rar-4)_5%,var(--surface))]',
        'rarity-5':
          'border-[color-mix(in_oklab,var(--rar-5)_38%,var(--line))] bg-[color-mix(in_oklab,var(--rar-5)_5%,var(--surface))]',
        /** An item the catalog cannot name: dimmed rather than hidden, because the whole point
         *  of the `other` bucket is that these stay visible until the catalog catches up. */
        unresolved: 'border-dashed border-line bg-[color-mix(in_oklch,var(--muted)_8%,var(--surface))]',
      },
      interactive: {
        /** A background lift, not a border swap — a `hover:border-*` utility outranks the
         *  rarity border by specificity and would repaint every card the same colour. */
        true: 'cursor-pointer hover:bg-[color-mix(in_oklch,var(--ink)_7%,var(--surface))]',
        false: 'cursor-default',
      },
    },
    defaultVariants: { tone: 'rarity-0', interactive: false },
  },
);

export type InventoryCardTone = NonNullable<VariantProps<typeof inventoryCardRecipe>['tone']>;

/** Rarity index → card tone, falling back to `comum` past the catalog's known rarities. */
export function inventoryCardTone(rarityIdx: number, defResolved: boolean): InventoryCardTone {
  if (!defResolved) return 'unresolved';
  const tone = `rarity-${rarityIdx}` as InventoryCardTone;
  return tone in RARITY_TONES ? tone : 'rarity-0';
}

const RARITY_TONES: Record<string, true> = {
  'rarity-0': true,
  'rarity-1': true,
  'rarity-2': true,
  'rarity-3': true,
  'rarity-4': true,
  'rarity-5': true,
};

export const inventoryBadgeRecipe = cva('rounded-full border px-1.5 py-0.5 text-[10px] leading-none', {
  variants: {
    tone: {
      neutral: 'border-line bg-surface text-muted',
      warn: 'border-warn bg-surface text-[color-mix(in_oklch,var(--warn)_80%,white_20%)]',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export type InventoryBadgeTone = NonNullable<VariantProps<typeof inventoryBadgeRecipe>['tone']>;

export const inventoryGridClass = 'grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-2';
