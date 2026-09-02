import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { MiniLiveLayoutView } from '@bombfarm/contracts';
import { isMiniSectionDisabled } from './mini-gear';

const EARNINGS_ONLY: MiniLiveLayoutView = {
  showEarnings: true,
  showMap: false,
  showHeroes: false,
  axis: 'vertical',
};

describe('MiniGear layout controls', () => {
  const source = readFileSync(join(__dirname, 'mini-gear.tsx'), 'utf8');

  it('defines three section controls and an axis control', () => {
    expect(source).toContain('liveEarningsTitle');
    expect(source).toContain('liveMapTitle');
    expect(source).toContain('liveHeroesTitle');
    expect(source).toContain('data-testid="mini-live-axis"');
  });

  it('disables the earnings control when it is the only section left on', () => {
    expect(isMiniSectionDisabled(EARNINGS_ONLY, 'showEarnings')).toBe(true);
    expect(isMiniSectionDisabled(EARNINGS_ONLY, 'showMap')).toBe(false);
  });
});
