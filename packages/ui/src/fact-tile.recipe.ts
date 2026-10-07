import { cva, type VariantProps } from 'class-variance-authority';

/**
 * FactTile chrome. `default` is the dense bordered cell of a facts grid with many entries;
 * `headline` is the Live tab's figure block — no box, a large bold figure under its label — for
 * a screen laying out a handful of headline figures in a row; `display` is the same block at a
 * size for the one or two figures a whole dialog turns on, whose label may wrap.
 */
export const factTileRecipe = cva('min-w-0', {
  variants: {
    size: {
      default: 'border border-line px-2.5 py-1.5',
      headline: 'flex flex-col gap-1',
      display: 'flex flex-col gap-1.5',
    },
  },
  defaultVariants: { size: 'default' },
});

export const factTileLabelRecipe = cva('m-0 text-muted uppercase', {
  variants: {
    size: {
      default: 'text-[10px] font-bold tracking-[0.08em]',
      headline: 'text-[10.5px] leading-none tracking-[0.06em] whitespace-nowrap',
      display: 'text-[11px] leading-snug tracking-[0.06em]',
    },
  },
  defaultVariants: { size: 'default' },
});

export const factTileValueRecipe = cva('m-0 font-bold tabular-nums', {
  variants: {
    size: {
      default: 'mt-1 truncate font-mono text-sm leading-tight',
      headline: 'text-[23px] leading-none whitespace-nowrap',
      display: 'text-[34px] leading-none whitespace-nowrap',
    },
  },
  defaultVariants: { size: 'default' },
});

export type FactTileSize = NonNullable<VariantProps<typeof factTileRecipe>['size']>;

export const factTileDetailClass = 'm-0 text-[11px] leading-none text-muted tabular-nums';
