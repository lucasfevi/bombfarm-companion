// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { emptyLoadout } from '@bombfarm/domain/gear';
import type { RosterHeroRow } from '../../model';
import { item, rowFixture } from '../../model/showcase.test-fixture';
import { RosterSummaryStrip } from './roster-summary-strip';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ROWS: readonly RosterHeroRow[] = [
  rowFixture({ id: 'ada', name: 'Ada', power: 100, rarity: 'Comum' }),
  rowFixture({ id: 'bo', name: 'Bo', power: 400, rarity: 'Mítico' }),
  rowFixture({ id: 'cy', name: 'Cy', power: 300, rarity: 'Épico', loadout: { ...emptyLoadout(), arma: item(120, 13) } }),
  rowFixture({ id: 'di', name: 'Di', power: 200, rarity: 'Épico' }),
  rowFixture({ id: 'ed', name: 'Ed', power: 999, rarity: 'Lendária', battleAllowed: false }),
];

describe('RosterSummaryStrip', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function mount(props: { maxPhase?: number | null; lang?: 'en' | 'pt' }) {
    act(() => {
      root.render(
        <RosterSummaryStrip
          rows={ROWS}
          maxPhase={props.maxPhase}
          lang={props.lang ?? 'en'}
        />,
      );
    });
  }

  const byTestId = (id: string) => container.querySelector(`[data-testid="${id}"]`);

  it('shows the squad power on its own, with no list of heroes beside it', () => {
    mount({});
    expect(byTestId('roster-summary-power')?.querySelectorAll('button, li')).toHaveLength(0);
    expect(container.querySelectorAll('[data-testid^="roster-summary-top-"]')).toHaveLength(0);
  });

  it('counts squad and bench, and legends the rarities rarest first with the empty ones left out', () => {
    mount({});
    expect(byTestId('roster-summary-heroes')?.textContent).toContain('4 in squad · 1 on bench');
    const legend = [...(byTestId('roster-summary-rarity-legend')?.querySelectorAll('li') ?? [])].map(
      (node) => node.textContent,
    );
    expect(legend).toEqual(['1 Mythic', '1 Legendary', '2 Epic', '1 Common']);
  });

  it('leaves the max phase cell out when the host has no reading, rather than printing a dash', () => {
    mount({ maxPhase: null });
    expect(byTestId('roster-summary-max-phase')).toBeNull();
    mount({ maxPhase: 137 });
    expect(byTestId('roster-summary-max-phase')?.textContent).toContain('137');
  });

  it('averages the squad gear over the items it actually wears', () => {
    mount({});
    const gear = byTestId('roster-summary-gear')?.textContent ?? '';
    expect(gear).toContain('Lv 120 · forged +13.0');
    expect(gear).toContain('across 1 equipped items');
  });
});
