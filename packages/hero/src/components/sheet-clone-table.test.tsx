import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { defsForSlot, emptyLoadout, emptySheetOther, setsForLevel, type Loadout } from '@bombfarm/domain/gear';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { sheetCloneCopyFor, statPanelCopyFor } from '../copy';
import { SheetCloneTable, type SheetCloneTableInput } from './sheet-clone-table';

const input: SheetCloneTableInput = {
  birth: { attack: 100, energy: 50, speed: 1, critChance: 0.1, critDmg: 1, penetration: 0.1, cdr: 0.1, luck: 0.1 },
  level: 10,
  stars: 0,
  sheetOther: emptySheetOther(),
  pts: ZERO_PTS(),
  tree: { danoStatic: 1, energyPct: 0, speedPct: 0, critChancePct: 0, critDmgPct: 0, luckFlatPct: 0 },
  runes: [],
};

const definition = defsForSlot('arma', setsForLevel(40)[0])[0];
const withWeapon: Loadout = {
  ...emptyLoadout(),
  arma: { defId: definition?.id ?? '', rarityIdx: 3, level: 40, upgrade: 5 },
};

const t = { ...statPanelCopyFor('en'), ...sheetCloneCopyFor('en') };

function render(loadout: Loadout, altLoadout: Loadout): string {
  return renderToStaticMarkup(
    <SheetCloneTable t={t} lang="en" input={input} loadout={loadout} altLoadout={altLoadout} />,
  );
}

describe('SheetCloneTable', () => {
  it('names the delta clone column', () => {
    expect(render(emptyLoadout(), emptyLoadout())).toContain(t.colSheetDeltaClone);
  });

  it('stacks nothing and tints nothing when the clone equals the current gear', () => {
    const markup = render(withWeapon, withWeapon);
    expect(markup).not.toContain('data-sheet-diff="changed"');
    expect(markup).not.toContain('data-clone-delta="up"');
    expect(markup).not.toContain('data-clone-delta="down"');
  });

  it('stacks the clone value under the current one and tints the delta up for a clone that adds a weapon', () => {
    const markup = render(emptyLoadout(), withWeapon);
    expect(markup).toContain('data-sheet-diff="changed"');
    expect(markup).toContain('data-clone-delta="up"');
    expect(markup).toContain('text-up');
  });

  it('tints the delta down for a clone that removes the weapon', () => {
    expect(render(withWeapon, emptyLoadout())).toContain('data-clone-delta="down"');
  });
});
