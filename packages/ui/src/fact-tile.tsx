'use client';

import type { ReactNode } from 'react';
import { cn } from './cn';
import { factTileLabelRecipe, factTileRecipe, factTileValueRecipe, type FactTileSize } from './fact-tile.recipe';
import { Tooltip } from './tooltip';

export type FactTileProps = {
  label: string;
  /** Rendered inside the value line; a string prints as-is, an element (a link, a glyph and a
   *  figure) is placed there unchanged. */
  value: ReactNode;
  /** Shown as a tooltip over the whole tile — the place for what the figure was read from or
   *  what it leaves out, never for a second figure. Needs a `Tooltip.Provider` above. */
  note?: string;
  /** `default` is the bordered cell of a facts grid; `headline` drops the box and enlarges the
   *  figure, for a row of a screen's few headline figures. */
  size?: FactTileSize;
  /** Tone for the value line; defaults to ink. */
  valueClassName?: string;
  className?: string;
  'data-testid'?: string;
};

/**
 * One labelled figure — the cell of a facts grid, where a screen lays a handful of a subject's
 * headline figures side by side (a hero's rarity, grade, level and power; an account's standing).
 * The grid is the caller's: this draws one cell.
 */
export function FactTile({ label, value, note, size = 'default', valueClassName, className, 'data-testid': testId }: FactTileProps) {
  const tile = (
    <div className={cn(factTileRecipe({ size }), className)} data-testid={testId}>
      <p className={factTileLabelRecipe({ size })}>{label}</p>
      <p className={cn(factTileValueRecipe({ size }), valueClassName ?? 'text-ink')}>{value}</p>
    </div>
  );
  if (note === undefined) return tile;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={tile} />
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup>
            <p className="m-0 max-w-[36ch]">{note}</p>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
