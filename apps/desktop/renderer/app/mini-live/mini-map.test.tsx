import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LiveMap, LiveMapEconomy } from '@bombfarm/contracts';
import { en } from '../../lib/copy/en';
import { MiniMap } from './mini-map';

vi.mock('../../lib/copy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/copy')>();
  return {
    ...actual,
    useCopy: () => en,
    useLocale: () => ({ locale: 'en', lang: 'en', bcp47: 'en-US' }),
  };
});

const ECONOMY: LiveMapEconomy = { xpPerProp: 310, averageGoldPerProp: 1_337, averageGoldPerClear: 100_275 };

function liveMap(overrides: Partial<LiveMap> = {}): LiveMap {
  return { phase: 61, healthFraction: 0.5, propsAlive: 22, propsTotal: 75, economy: ECONOMY, ...overrides };
}

function html(map: LiveMap | null): string {
  return renderToStaticMarkup(createElement(MiniMap, { map }));
}

describe('MiniMap', () => {
  it('prints health percent and renders the health bar track', () => {
    const out = html(liveMap({ healthFraction: 0.5 }));
    expect(out).toContain('data-testid="live-map-health"');
    expect(out).toContain('50%');
    expect(out).toContain('data-testid="live-map-health-bar"');
  });

  it('renders empty dashes and an empty health track when map is null', () => {
    expect(() => html(null)).not.toThrow();
    const out = html(null);
    expect(out).toContain('>—<');
    expect(out).toContain('data-testid="live-map-health-bar"');
  });
});
