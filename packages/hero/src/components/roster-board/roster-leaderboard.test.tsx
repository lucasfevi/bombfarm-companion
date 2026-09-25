// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { numberFormatterFor } from '@bombfarm/ui';
import type { RosterBoardCopy } from '../../copy';
import {
  DEFAULT_LEADERBOARD_VIEW,
  heroStatSheet,
  sheetTotalText,
  type LeaderboardView,
  type RosterHeroRow,
} from '../../model';
import { NEUTRAL_TREE, ZERO_SHEET, item, rowFixture } from '../../model/showcase.test-fixture';
import { RosterLeaderboard } from './roster-leaderboard';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const HOST_COPY = new Proxy({}, { get: (_target, key) => String(key) }) as RosterBoardCopy;

const BIRTH = { ...ZERO_SHEET, attack: 180, energy: 200, speed: 50, critChance: 7, critDmg: 60, cdr: 2 };
const TREE = { ...NEUTRAL_TREE, danoStatic: 1.3, critChancePct: 8, luckFlatPct: 2 };

const ROWS: readonly RosterHeroRow[] = [
  rowFixture({ id: 'cy', name: 'Cy', power: 300, birth: BIRTH, stars: 2, level: 90 }),
  rowFixture({ id: 'ada', name: 'Ada', power: 100, birth: { ...BIRTH, critChance: 20 } }),
  rowFixture({
    id: 'bo',
    name: 'Bo',
    power: 400,
    birth: BIRTH,
    loadout: { ...emptyLoadout(), arma: item(120, 3), elmo: item(130, 3) },
  }),
  rowFixture({ id: 'ed', name: 'Ed', power: 999, battleAllowed: false }),
];

function Harness({ onSelectHeroId }: { onSelectHeroId: (id: string) => void }) {
  const [view, setView] = useState<LeaderboardView>(DEFAULT_LEADERBOARD_VIEW);
  return (
    <RosterLeaderboard
      rows={ROWS}
      tree={TREE}
      view={view}
      onViewChange={setView}
      selectedId="bo"
      onSelectHeroId={onSelectHeroId}
      t={HOST_COPY}
      lang="en"
    />
  );
}

describe('RosterLeaderboard', () => {
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

  function mount(onSelectHeroId: (id: string) => void = () => undefined) {
    act(() => {
      root.render(<Harness onSelectHeroId={onSelectHeroId} />);
    });
  }

  const rowIds = () =>
    [...container.querySelectorAll('[data-testid^="heroes-leaderboard-row-"]')].map((node) =>
      node.getAttribute('data-testid')?.replace('heroes-leaderboard-row-', ''),
    );
  const header = (column: string) =>
    container.querySelector(`[data-testid="heroes-leaderboard-sort-${column}"]`) as HTMLTableCellElement;
  const pressHeader = (column: string) => {
    act(() => {
      (header(column).querySelector('button') as HTMLButtonElement).click();
    });
  };
  const pressFilter = (label: string) => {
    const button = [...container.querySelectorAll('button')].find((node) => node.textContent === label);
    act(() => {
      (button as HTMLButtonElement).click();
    });
  };

  it('opens on power, strongest first, and says so on the header', () => {
    mount();
    expect(rowIds()).toEqual(['ed', 'bo', 'cy', 'ada']);
    expect(header('power').getAttribute('aria-sort')).toBe('descending');
    expect(header('name').getAttribute('aria-sort')).toBe('none');
  });

  it('reverses the order on a second press of the sorted header', () => {
    mount();
    pressHeader('power');
    expect(header('power').getAttribute('aria-sort')).toBe('ascending');
    expect(rowIds()).toEqual(['ada', 'cy', 'bo', 'ed']);
    pressHeader('power');
    expect(header('power').getAttribute('aria-sort')).toBe('descending');
  });

  it('sorts names A to Z on their first press, and moves the sort mark to that header', () => {
    mount();
    pressHeader('name');
    expect(rowIds()).toEqual(['ada', 'bo', 'cy', 'ed']);
    expect(header('name').getAttribute('aria-sort')).toBe('ascending');
    expect(header('power').getAttribute('aria-sort')).toBe('none');
  });

  it('narrows to the squad or the bench', () => {
    mount();
    pressFilter('Bench');
    expect(rowIds()).toEqual(['ed']);
    pressFilter('Squad');
    expect(rowIds()).toEqual(['bo', 'cy', 'ada']);
    pressFilter('Everyone');
    expect(rowIds()).toHaveLength(4);
  });

  it('selects a hero from a row click, and from Enter on a focused row', () => {
    const onSelectHeroId = vi.fn();
    mount(onSelectHeroId);
    const cy = container.querySelector('[data-testid="heroes-leaderboard-row-cy"]') as HTMLTableRowElement;
    act(() => {
      cy.click();
    });
    expect(onSelectHeroId).toHaveBeenLastCalledWith('cy');

    const ada = container.querySelector('[data-testid="heroes-leaderboard-row-ada"]') as HTMLTableRowElement;
    expect(ada.tabIndex).toBe(0);
    act(() => {
      ada.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(onSelectHeroId).toHaveBeenLastCalledWith('ada');
  });

  it('prints each statistic as the hero panel’s Total column prints that hero’s sheet', () => {
    mount();
    const hero = ROWS[1]?.hero;
    const sheet = hero && heroStatSheet(hero, TREE);
    expect(sheet).toBeDefined();
    const format = numberFormatterFor('en');
    const ada = container.querySelector('[data-testid="heroes-leaderboard-row-ada"]') as HTMLElement;
    for (const key of ['attack', 'critChance', 'critDmg', 'luck', 'speed'] as const) {
      const cell = ada.querySelector(`[data-testid="heroes-leaderboard-stat-${key}"]`);
      expect(cell?.textContent).toBe(sheetTotalText(key, sheet?.[key] ?? Number.NaN, format));
    }
  });

  it('marks the selected row, mutes a bench hero, and prints gear as pieces and level or a dash', () => {
    mount();
    const bo = container.querySelector('[data-testid="heroes-leaderboard-row-bo"]') as HTMLElement;
    const ed = container.querySelector('[data-testid="heroes-leaderboard-row-ed"]') as HTMLElement;
    expect(bo.getAttribute('aria-current')).toBe('true');
    expect(bo.querySelector('[data-testid="heroes-leaderboard-gear"]')?.textContent).toBe('2/8 · Lv 125');
    expect(ed.className).toContain('grayscale');
    expect(ed.querySelector('[data-testid="heroes-leaderboard-gear"]')?.textContent).toBe('—');
    expect(ed.querySelector('[data-testid="heroes-leaderboard-stat-attack"]')?.textContent).toBe('—');
  });
});
