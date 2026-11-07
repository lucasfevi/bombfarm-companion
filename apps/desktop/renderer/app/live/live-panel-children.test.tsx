import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LiveFastModel, LiveSlowModel } from '../../lib/live/live-model';
import { LivePanel } from './live-panel';

const slow: LiveSlowModel = {
  onField: [],
  recovering: [],
  queued: [],
  benched: [],
  unclassifiedCount: 2,
  fieldExitPendingCount: 1,
  occupancy: { occupied: 0, fieldSize: 6 },
  house: {},
};
const fast: LiveFastModel = { field: {}, recovery: {}, energy: {} };

describe('LivePanel children', () => {
  it('renders them as the last child of the panel root, after every other block', () => {
    const html = renderToStaticMarkup(
      createElement(LivePanel, { freshness: { kind: 'live' }, slow, fast }, createElement('i', { 'data-testid': 'tail' })),
    );
    expect(html.indexOf('data-testid="tail"')).toBeGreaterThan(html.indexOf('data-testid="live-field-exit-pending-count"'));
    expect(html.endsWith('<i data-testid="tail"></i></div>')).toBe(true);
  });

  it('adds nothing when there are none', () => {
    const html = renderToStaticMarkup(createElement(LivePanel, { freshness: { kind: 'live' }, slow, fast }));
    expect(html.endsWith('</p></div>')).toBe(true);
  });
});
