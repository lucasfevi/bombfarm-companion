import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildInventoryView } from '@bombfarm/domain/inventory-view';
import { CopyProvider } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import { resolveStoneRanges } from '../../lib/forge/forge-stones';
import { forgeLabels } from './forge-labels';
import { ForgeForecastPanel } from './forge-plan-panel';

const labels = forgeLabels(en, 'en', 'en');

function render(walletGold: number | null, walletEssence: number | null): string {
  const item = buildInventoryView([
    { id: 'g1', def_id: 'steel_luva', category: 0, set: 'steel', rarity: 2, level: 20, upgrade: 8, power: 1, stats: [] },
  ]).items[0];
  if (!item) throw new Error('no test row');
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale: 'en',
      children: createElement(ForgeForecastPanel, {
        item,
        plan: { itemId: 'g1', target: 12, maxGold: null, attempts: null, stones: [], scroll: false },
        forecast: null,
        stoneRanges: resolveStoneRanges([], 8, 12),
        ownedStones: [0, 0, 0, 0, 0, 0],
        walletGold,
        walletEssence,
        reason: 'ready',
        startRefusal: null,
        labels,
        onForge: () => undefined,
        onCancel: () => undefined,
      }),
    }),
  );
}

describe('ForgeForecastPanel facts', () => {
  it('lists the essence on hand right after the wallet', () => {
    const html = render(5_000, 12_345);
    expect(html).toContain('data-testid="forge-fact-wallet-essence"');
    expect(html).toContain('12,345');
    expect(html.indexOf('data-testid="forge-fact-wallet"')).toBeLessThan(html.indexOf('data-testid="forge-fact-wallet-essence"'));
  });

  it('leaves the figure blank when the account has no essence reading', () => {
    const html = render(5_000, null);
    expect(html).toContain('data-testid="forge-fact-wallet-essence"');
    expect(html).not.toContain('12,345');
  });
});
