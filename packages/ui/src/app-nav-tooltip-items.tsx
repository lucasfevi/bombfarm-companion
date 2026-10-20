'use client';

import type { ReactElement } from 'react';
import { Tooltip } from './tooltip';

export interface AppNavTooltipEntry {
  id: string;
  button: ReactElement;
  tipLines: readonly string[];
  popupTestId: string | undefined;
}

export function AppNavTooltipItems({ entries }: { entries: readonly AppNavTooltipEntry[] }) {
  return (
    <Tooltip.Provider delay={200} closeDelay={80}>
      {entries.map((entry) => {
        if (entry.tipLines.length === 0) return entry.button;
        return (
          <Tooltip.Root key={entry.id}>
            <Tooltip.Trigger render={entry.button} />
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={6}>
                <Tooltip.Popup data-testid={entry.popupTestId}>
                  {entry.tipLines.map((line, index) => (
                    <p key={index} className="m-0">
                      {line}
                    </p>
                  ))}
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        );
      })}
    </Tooltip.Provider>
  );
}
