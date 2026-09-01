'use client';

import { Tooltip } from '@bombfarm/ui';
import { DropIcon, GoldIcon } from '@bombfarm/game-art';

/** Fixed Inferno/mythic band for every header icon — a column header covers every phase at once,
 *  and Inferno's art is the sharpest version of each sprite. */
const HEADER_ICON_BAND = 5;

/**
 * Header art per resource column, at `DropIcon`'s own default `size-8`, matching the Drops
 * panel's chest art. `gold` reuses `GoldIcon` sized up to match; `gems` shows the gem CHEST art
 * (`dropIconSrc`'s `gem` case) rather than the loose-gem crystal, since the column pays out a
 * chest. `null` for columns with no matching in-game resource.
 */
export function farmColumnHeaderIcon(columnId: string) {
  switch (columnId) {
    case 'gold':
      return <GoldIcon className="size-7" />;
    case 'chests':
      return <DropIcon id="chest" ato={HEADER_ICON_BAND} />;
    case 'keys':
      return <DropIcon id="key" ato={HEADER_ICON_BAND} />;
    case 'gems':
      return <DropIcon id="gem" ato={HEADER_ICON_BAND} />;
    case 'timePieces':
      return <DropIcon id="time" ato={HEADER_ICON_BAND} />;
    default:
      return null;
  }
}

/**
 * A resource column's header content: the sprite alone, on one line — no visible label, so the
 * five headers stop line-wrapping into a two-tier row. The label survives as `sr-only` text (kept
 * OUTSIDE the `Tooltip.Trigger`, so hovering the sprite is the only thing that opens the tooltip)
 * so `aria-sort`'s accessible name, the sort live-region and the e2e header-text matchers all see
 * the same string as before. The sprite itself is decorative (`DropIcon`/`GoldIcon` already ship
 * `alt=""` + `aria-hidden`).
 */
export function FarmColumnHeaderLabel({ columnId, label }: { columnId: string; label: string }) {
  const icon = farmColumnHeaderIcon(columnId);
  if (!icon) return <>{label}</>;

  return (
    <Tooltip.Provider delay={200} closeDelay={80}>
      <Tooltip.Root>
        <Tooltip.Trigger render={<span className="inline-flex" />}>{icon}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={6}>
            <Tooltip.Popup>{label}</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
      <span className="sr-only">{label}</span>
    </Tooltip.Provider>
  );
}
