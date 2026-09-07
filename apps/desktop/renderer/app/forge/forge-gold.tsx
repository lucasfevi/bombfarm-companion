'use client';

import type { ReactNode } from 'react';
import { GoldValue } from '@bombfarm/game-art';

/**
 * A gold figure on the Forge screen. The whole screen is arithmetic about one currency, and a
 * column of bare numbers gives a reader nothing to tell a spend from a roll count at a glance —
 * so every gold figure carries the game's own coin, and only gold figures do.
 *
 * The coin is sized in `em` rather than in a fixed step: these figures are printed at four
 * different type sizes across the panels, and a fixed coin would sit a rung too large beside the
 * smallest of them.
 *
 * Half of these figures sit inside a sentence — the run band's header, the result's figures line —
 * so they all take the baseline form, which is what makes a gold chunk share a line with the words
 * around it.
 */
export function ForgeGold({ children }: { children: ReactNode }) {
  return (
    <GoldValue baseline iconClassName="size-[1.15em]">
      {children}
    </GoldValue>
  );
}
