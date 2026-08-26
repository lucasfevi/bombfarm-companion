import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OccupancyReadout } from './occupancy-readout';

const NO_ALARM_CLASS_FRAGMENTS = ['warn', 'danger', 'alert', 'error', 'destructive'];

describe('OccupancyReadout — occupancy carries no alarm', () => {
  it('renders occupied against the field size as plain text', () => {
    const html = renderToStaticMarkup(createElement(OccupancyReadout, { occupancy: { occupied: 2, fieldSize: 5 } }));
    expect(html).toContain('data-testid="live-occupancy"');
    expect(html).toContain('2');
    expect(html).toContain('5');
  });

  it('carries no warning treatment even when most of the field sits idle', () => {
    const html = renderToStaticMarkup(createElement(OccupancyReadout, { occupancy: { occupied: 0, fieldSize: 6 } }));
    for (const fragment of NO_ALARM_CLASS_FRAGMENTS) {
      expect(html.toLowerCase()).not.toContain(fragment);
    }
    expect(html).not.toContain('role="alert"');
  });

  it('carries no warning treatment when the field is completely full either', () => {
    const html = renderToStaticMarkup(createElement(OccupancyReadout, { occupancy: { occupied: 6, fieldSize: 6 } }));
    for (const fragment of NO_ALARM_CLASS_FRAGMENTS) {
      expect(html.toLowerCase()).not.toContain(fragment);
    }
  });

  it('falls back to occupied-only phrasing when the field size was never sent', () => {
    const html = renderToStaticMarkup(createElement(OccupancyReadout, { occupancy: { occupied: 3 } }));
    expect(html).toContain('3');
  });
});
