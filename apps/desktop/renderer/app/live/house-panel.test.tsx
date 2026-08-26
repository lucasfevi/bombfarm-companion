import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { STRINGS } from '../../lib/copy';
import { HousePanel } from './house-panel';

const en = STRINGS.en;

describe('HousePanel — house data absent while heroes present', () => {
  it('shows as absent, not zeroed, when the game has sent nothing for the house', () => {
    const html = renderToStaticMarkup(createElement(HousePanel, { house: {} }));
    expect(html).toContain('data-testid="live-house"');
    expect(html).toContain(en.liveHouseAbsent);
    expect(html).not.toMatch(/>\s*0\s*</);
  });
});

describe('HousePanel — a house with some fields present', () => {
  it('renders the fields the game sent and the missing-data string for the ones it did not', () => {
    const html = renderToStaticMarkup(createElement(HousePanel, { house: { slots: 5, cycleSeconds: 900 } }));
    expect(html).toContain(en.liveHouseSlotsLabel);
    expect(html).toContain('5');
    expect(html).toContain('15:00');
    expect(html).toContain(en.fidelityStatusMissing);
    expect(html).not.toContain(en.liveHouseAbsent);
  });

  it('a genuine zero slot count renders 0, not the missing-data string', () => {
    const html = renderToStaticMarkup(createElement(HousePanel, { house: { slots: 0, cycleSeconds: 900 } }));
    expect(html).toContain('>0<');
  });

  it('renders the rescues line only once both rescuesLeft and rescuesMax are present', () => {
    const withOnly = renderToStaticMarkup(createElement(HousePanel, { house: { rescuesLeft: 2 } }));
    const withBoth = renderToStaticMarkup(createElement(HousePanel, { house: { rescuesLeft: 2, rescuesMax: 5 } }));
    expect(withOnly).toContain(en.fidelityStatusMissing);
    expect(withBoth).toContain('2');
    expect(withBoth).toContain('5');
  });
});
