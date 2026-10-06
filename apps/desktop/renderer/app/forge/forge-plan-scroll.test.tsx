import { describe, expect, it } from 'vitest';
import { Fragment, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildInventoryView, type InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { CopyProvider } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import { resolveStoneRanges } from '../../lib/forge/forge-stones';
import { forgePlanForecast, type ForgePlan } from '../../lib/forge/use-forge-plan';
import { forgeLabels } from './forge-labels';
import { ForgeForecastPanel, ForgePlanPanel, climbOffersScroll } from './forge-plan-panel';

const labels = forgeLabels(en, 'en', 'en');

function piece(upgrade: number): InventoryViewItem {
  const found = buildInventoryView([
    { id: 'g1', def_id: 'steel_luva', category: 0, set: 'steel', rarity: 2, level: 20, upgrade, power: 1, stats: [] },
  ]).items[0];
  if (!found) throw new Error('no test row');
  return found;
}

function render(from: number, target: number, scroll: boolean): string {
  const item = piece(from);
  const plan: ForgePlan = { itemId: 'g1', target, maxGold: null, attempts: null, stones: [], scroll };
  const stoneRanges = resolveStoneRanges([], from, target);
  const ownedStones = [0, 0, 0, 0, 0, 0];
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale: 'en',
      children: createElement(
        Fragment,
        null,
        createElement(ForgePlanPanel, {
          item,
          plan,
          stoneRanges,
          ownedStones,
          running: false,
          labels,
          onStepTarget: () => undefined,
          onStoneEdit: () => undefined,
          onMaxGoldChange: () => undefined,
          onAttemptsChange: () => undefined,
          onScrollChange: () => undefined,
        }),
        createElement(ForgeForecastPanel, {
          item,
          plan,
          forecast: forgePlanForecast(from, target, 20, 2, 0, 0, undefined, scroll),
          stoneRanges,
          ownedStones,
          walletGold: null,
          reason: 'ready',
          startRefusal: null,
          labels,
          onForge: () => undefined,
          onCancel: () => undefined,
        }),
      ),
    }),
  );
}

describe('climbOffersScroll', () => {
  it('is true once the climb reaches a rung the game offers the scroll on, and false below it', () => {
    expect(climbOffersScroll(8, 11)).toBe(false);
    expect(climbOffersScroll(8, 12)).toBe(true);
    expect(climbOffersScroll(12, 13)).toBe(true);
    expect(climbOffersScroll(15, 15)).toBe(false);
  });
});

describe('the Protection Scroll switch', () => {
  it('is not offered on a climb that never reaches a rung that can lose a level', () => {
    const html = render(8, 11, false);
    expect(html).not.toContain('data-testid="forge-scroll"');
    expect(html).not.toContain('data-testid="forge-scroll-other"');
  });

  it('is offered off by default, with the other option priced beside the forecast', () => {
    const html = render(8, 15, false);
    expect(html).toMatch(/data-testid="forge-scroll"[^>]*data-state="off"/);
    expect(html).toContain(en.forgeScrollLabel);
    expect(html).not.toContain('data-testid="forge-scroll-prices"');
    expect(html).not.toContain('data-testid="forge-scroll-notice"');
    expect(html).toMatch(/data-testid="forge-scroll-other"[^>]*>With the scroll: /);
    expect(html).not.toContain('data-testid="forge-ladder-scroll"');
  });

  it('when on, prices each covered level, marks the rungs it protects and compares with going without', () => {
    const html = render(8, 15, true);
    expect(html).toMatch(/data-testid="forge-scroll"[^>]*data-state="on"/);
    expect(html).toMatch(/data-testid="forge-scroll-prices"[^>]*>Per roll: .* at level 12 · .* at level 13 · .* at level 14 · .* at level 15</);
    expect(html.match(/data-testid="forge-ladder-scroll"/g)).toHaveLength(4);
    expect(html.match(/data-scroll="on"/g)).toHaveLength(4);
    expect(html).toContain('data-testid="forge-scroll-notice"');
    expect(html).toMatch(/data-testid="forge-scroll-other"[^>]*>Without the scroll: /);
  });

  it('leaves the rungs below the first protected one on their plain fall target', () => {
    const html = render(8, 15, true);
    const rungs = html.split('data-testid="forge-ladder-rung"').slice(1);
    expect(rungs).toHaveLength(7);
    expect(rungs.filter((rung) => rung.includes('data-scroll="on"'))).toHaveLength(4);
    expect(rungs.filter((rung) => rung.includes('fail → '))).toHaveLength(3);
  });

  it('freezes with the rest of the controls while a run is in flight', () => {
    const item = piece(11);
    const html = renderToStaticMarkup(
      createElement(CopyProvider, {
        locale: 'en',
        children: createElement(ForgePlanPanel, {
          item,
          plan: { itemId: 'g1', target: 13, maxGold: null, attempts: null, stones: [], scroll: true },
          stoneRanges: resolveStoneRanges([], 11, 13),
          ownedStones: [0, 0, 0, 0, 0, 0],
          running: true,
          labels,
          onStepTarget: () => undefined,
          onStoneEdit: () => undefined,
          onMaxGoldChange: () => undefined,
          onAttemptsChange: () => undefined,
          onScrollChange: () => undefined,
        }),
      }),
    );
    expect(html).toMatch(/<fieldset disabled=""[^>]*data-testid="forge-plan-controls"/);
    expect(html).toMatch(/role="switch"[^>]*aria-disabled="true"/);
  });
});
