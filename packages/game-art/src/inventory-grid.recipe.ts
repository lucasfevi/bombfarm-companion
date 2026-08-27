import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Rarity is the card's chrome, matching the game's own inventory plates: the border carries the
 * rarity hue muted into the panel line so a wall of `comum` gear stays quiet, and the fill is a
 * few percent of the same hue. Equipped state is NOT a colour here — it is the hero named in the
 * card's footer, because on a played account nearly every item is equipped and colouring them
 * all leaves the grid one flat tone.
 *
 * `in oklab`, not the repo's usual `in oklch`: polar mixing walks the shorter arc of the hue
 * circle, and `--line`'s hue 48 to `--rar-2`'s blue is shorter going backwards through magenta.
 * That painted the rare tier pink and the epic tier red. Oklab is rectangular and stays on the
 * line between the two colours.
 */
export const inventoryCardRecipe = cva(
  'flex min-w-0 flex-col gap-2 rounded-lg border p-3 text-left motion-safe:transition-[border-color,background-color] motion-safe:duration-[120ms]',
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
        /** An item the app cannot name: dimmed rather than hidden, because the whole point of
         *  the `other` bucket is that these stay visible until the app catches up. */
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

const RARITY_TONES = new Set(['rarity-0', 'rarity-1', 'rarity-2', 'rarity-3', 'rarity-4', 'rarity-5']);

/** Rarity index → card tone, falling back to `comum` past the catalog's known rarities. */
export function inventoryCardTone(rarityIdx: number, defResolved: boolean): InventoryCardTone {
  if (!defResolved) return 'unresolved';
  const tone = `rarity-${Math.round(rarityIdx)}`;
  return RARITY_TONES.has(tone) ? (tone as InventoryCardTone) : 'rarity-0';
}

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

/** Wide enough for a 64px icon beside four stat lines without the text wrapping to two columns. */
export const inventoryGridClass = 'grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-2.5';

/** Toolbar chip — the kind and rarity filters, and the equipped toggle. */
export const inventoryChipRecipe = cva(
  'cursor-pointer rounded-full border px-2.5 py-1 text-xs leading-none motion-safe:transition-[border-color,background-color] motion-safe:duration-[120ms]',
  {
    variants: {
      active: {
        true: 'border-accent bg-[color-mix(in_oklch,var(--accent)_18%,var(--surface))] text-ink',
        false: 'border-line bg-surface text-muted hover:border-[color-mix(in_oklch,var(--accent)_45%,var(--line))]',
      },
    },
    defaultVariants: { active: false },
  },
);

/** The stack count on a fungible item's card — the game draws this bottom-right of the tile. */
export const inventoryCountClass =
  'shrink-0 rounded-md border border-line bg-[color-mix(in_oklch,var(--bg)_60%,var(--surface))] px-1.5 py-0.5 text-xs font-semibold tabular-nums text-ink';
