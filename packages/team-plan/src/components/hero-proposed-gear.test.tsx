import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SLOTS } from '@bombfarm/domain/gear';
import { slotLabel } from '@bombfarm/domain/game-labels';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { teamPlanEn, type TeamPlanScreenCopy } from '../copy';
import type { GearFlowRow } from '../model/gear-flow-rows';
import { HeroProposedGear, type HeroGearFlow } from './hero-proposed-gear';

const copy = {
  ...teamPlanEn,
  rankLv: 'Lv',
} as unknown as TeamPlanScreenCopy;

function keptRow(slot: string, itemId = `item-${slot}`): GearFlowRow {
  return {
    itemId,
    defId: `set_${slot}_1`,
    slot,
    rarityIdx: 0,
    level: 10,
    upgrade: 0,
    forge: null,
    originHeroId: 'hero-1',
    destHeroId: 'hero-1',
  };
}

function render(gear: Partial<HeroGearFlow>) {
  return renderToStaticMarkup(
    createElement(HeroProposedGear, {
      t: copy,
      lang: 'en',
      gear: { rows: [], removed: [], crowdedField: false, ...gear },
      heroByScopeKey: new Map<string, HeroRecord>(),
      heroNameFallback: (heroId) => heroId,
    }),
  );
}

const countOf = (html: string, needle: string) => html.split(needle).length - 1;
/** The visible line only — the same words also sit in each card's aria-label. */
const keptCards = (html: string) => countOf(html, `${copy.teamPlanFlowRowExisting}</div>`);

describe('HeroProposedGear — every catalog slot is drawn', () => {
  it('draws a named empty card for the one slot the plan leaves out of a seven-item loadout', () => {
    const html = render({ rows: SLOTS.filter((slot) => slot !== 'anel').map((slot) => keptRow(slot)) });
    expect(countOf(html, copy.teamPlanFlowSlotEmpty)).toBe(1);
    expect(html).toContain(slotLabel('anel', 'en'));
    expect(keptCards(html)).toBe(SLOTS.length - 1);
  });

  it('draws eight empty cards, in catalog order, for a hero the plan gives nothing', () => {
    const html = render({ rows: [] });
    expect(countOf(html, copy.teamPlanFlowSlotEmpty)).toBe(SLOTS.length);
    const positions = SLOTS.map((slot) => html.indexOf(`>${slotLabel(slot, 'en')}<`));
    expect(positions.every((at) => at >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('keeps a row whose slot the catalog does not know rather than dropping it', () => {
    const html = render({ rows: [keptRow('mystery', 'item-x')] });
    expect(countOf(html, copy.teamPlanFlowSlotEmpty)).toBe(SLOTS.length);
    expect(keptCards(html)).toBe(1);
  });

  it('still draws the full grid beside the removals section', () => {
    const html = render({
      rows: [],
      removed: [{ ...keptRow('arma', 'item-off'), destHeroId: null }],
    });
    expect(countOf(html, copy.teamPlanFlowSlotEmpty)).toBe(SLOTS.length);
    expect(html).toContain(copy.teamPlanFlowRemovedHeading);
  });
});
