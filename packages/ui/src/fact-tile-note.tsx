'use client';

import type { ReactElement } from 'react';
import { Tooltip } from './tooltip';

/**
 * The tooltip half of `FactTile`. It is the only part that reaches `Tooltip`, and through it
 * `motion`, so `fact-tile` loads it lazily and only for a tile that carries a note.
 */
export function FactTileNote({ tile, note, arrived }: { tile: ReactElement; note: string; arrived?: boolean }) {
  return (
    <Tooltip.Root defaultOpen={arrived === true}>
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
