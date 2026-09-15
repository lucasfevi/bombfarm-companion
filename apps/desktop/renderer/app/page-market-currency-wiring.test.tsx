import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

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
