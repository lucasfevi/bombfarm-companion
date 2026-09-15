import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const RENDERER_ROOT = join(__dirname, '..');

describe('page.tsx — the market currency select is pinned to its channel and its own warning', () => {
  const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

  it('renders MarketSection between ForgeSection and ConsentSection in the settings view', () => {
    const forgeIdx = source.indexOf('<ForgeSection');
    const marketIdx = source.indexOf('<MarketSection');
    const consentIdx = source.indexOf('<ConsentSection');
    expect(forgeIdx).toBeGreaterThanOrEqual(0);
    expect(marketIdx).toBeGreaterThan(forgeIdx);
    expect(consentIdx).toBeGreaterThan(marketIdx);
  });

  it('reads marketQuoteCurrency from settings:get alongside the other stored fields', () => {
    const readStart = source.indexOf(".invoke('settings:get')");
    expect(readStart).toBeGreaterThanOrEqual(0);
    const readEnd = source.indexOf('.catch', readStart);
    expect(source.slice(readStart, readEnd)).toContain('setMarketQuoteCurrency(settings.marketQuoteCurrency)');
  });

  it('onMarketQuoteCurrencyChange invokes settings:setMarketQuoteCurrency and surfaces marketQuoteCurrencyWarning, not another warning', () => {
    const handlerStart = source.indexOf('const onMarketQuoteCurrencyChange');
    expect(handlerStart).toBeGreaterThanOrEqual(0);
    const handlerEnd = source.indexOf('};', handlerStart);
    const handler = source.slice(handlerStart, handlerEnd);

    expect(handler).toContain("'settings:setMarketQuoteCurrency'");
    expect(handler).toContain('setMarketQuoteCurrency(result.settings.marketQuoteCurrency)');
    expect(handler).toContain('setMarketQuoteCurrencyWarning');
    expect(handler).not.toContain('setPersistWarning');
    expect(handler).not.toContain('setAlwaysOnTopWarning');
    expect(handler).not.toContain('setForgeWritesWarning');
    expect(handler).not.toContain('setRestartGameOnExitWarning');
  });
});

describe('page.tsx — every screen that prices something reads the same market currency', () => {
  const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

  it.each(['<InventoryView', '<HeroesView', '<AccountView'])('%s is handed marketQuoteCurrency', (tag) => {
    const start = source.indexOf(tag);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = source.indexOf('/>', start);
    expect(source.slice(start, end)).toContain('marketQuoteCurrency={marketQuoteCurrency}');
  });
});

describe('renderer production code names no currency of its own', () => {
  // A quote fetched in the chosen currency lands under that key in `lowestNative`; a screen that
  // resolves prices with a literal code would never read it. The literal belongs to the setting's
  // default in the contracts package, nowhere in this tree.
  it("no 'BRL' literal outside tests", () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && /['"]BRL['"]/.test(readFileSync(full, 'utf8')))
          offenders.push(relative(RENDERER_ROOT, full));
      }
    };
    walk(RENDERER_ROOT);
    expect(offenders).toEqual([]);
  });
});
