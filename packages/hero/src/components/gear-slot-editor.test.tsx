import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { defsForSlot, setsForLevel, type EquippedItem } from '@bombfarm/domain/gear';
import { rarityTextClass } from '@bombfarm/game-art';
import { gearPanelCopyFor, statPanelCopyFor } from '../copy';
import { GearSlotEditor } from './gear-slot-editor';

function renderWithRarity(rarityIdx: number): string {
  const definition = defsForSlot('arma', setsForLevel(40)[0])[0];
  const equipped: EquippedItem = { defId: definition?.id ?? '', rarityIdx, level: 40, upgrade: 0 };
  const t = { ...gearPanelCopyFor('en'), ...statPanelCopyFor('en') };
  return renderToStaticMarkup(
    <GearSlotEditor slot="arma" equipped={equipped} t={t} lang="en" onPatch={() => {}} />,
  );
}

describe('GearSlotEditor rarity picker', () => {
  it.each([0, 1, 2, 3, 4, 5])('prints rarity %i in its rarity colour on the closed trigger', (rarityIdx) => {
    const markup = renderWithRarity(rarityIdx);
    expect(markup).toContain(`class="${rarityTextClass(rarityIdx)}" data-rarity="${rarityIdx}"`);
  });
});
