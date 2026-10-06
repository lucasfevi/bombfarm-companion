'use client';

import type { ReactElement } from 'react';
import { chanceStoneDefId } from '@bombfarm/domain/inventory-view';
import { ItemIcon } from '@bombfarm/game-art';
import { Tooltip, cn } from '@bombfarm/ui';

export function StoneIcon({ rarity, dim = false, small = false }: { rarity: number; dim?: boolean; small?: boolean }) {
  return (
    <span data-testid="forge-stone-icon" data-rarity={rarity} className={cn('inline-flex', 'shrink-0', dim && 'opacity-40')}>
      <ItemIcon
        item={{ defId: chanceStoneDefId(rarity), rarityIdx: rarity, level: 0, upgrade: 0, kind: 'chanceStone' }}
        size="xs"
        className={cn(small && 'w-5')}
      />
    </span>
  );
}

/** The box a stone's art fills, kept empty where no stone is chosen so a picker is as tall either way. */
export function StoneIconPlaceholder() {
  return <span aria-hidden="true" data-testid="forge-stone-placeholder" className={cn('inline-block', 'aspect-[18/19]', 'w-7', 'shrink-0')} />;
}

export function StoneTooltip({ text, trigger }: { text: string; trigger: ReactElement }) {
  return (
    <Tooltip.Provider delay={200} closeDelay={80}>
      <Tooltip.Root>
        <Tooltip.Trigger render={trigger} />
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={6}>
            <Tooltip.Popup>
              <p className="m-0">{text}</p>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
