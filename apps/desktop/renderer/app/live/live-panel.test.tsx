import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { STRINGS } from '../../lib/copy';
import type { LiveFastModel, LiveSlowModel } from '../../lib/live/live-model';
import { LivePanel } from './live-panel';

const en = STRINGS.en;

function slowModel(overrides: Partial<LiveSlowModel> = {}): LiveSlowModel {
  return {
    onField: [],
    recovering: [],
    queued: [],
    benched: [],
    unclassifiedCount: 0,
    fieldExitPendingCount: 0,
    occupancy: { occupied: 0, fieldSize: 6 },
    house: {},
    ...overrides,
  };
}

const emptyFast: LiveFastModel = { field: {}, recovery: {} };

describe('LivePanel — composition', () => {
  it('carries the panel root testid, the freshness line, the house panel, and the field occupancy count', () => {
    const html = renderToStaticMarkup(
      createElement(LivePanel, { freshness: { kind: 'live' }, slow: slowModel(), fast: emptyFast }),
    );
    expect(html).toContain('data-testid="live-panel"');
    expect(html).toContain('data-testid="live-freshness"');
    expect(html).toContain('data-testid="live-house"');
    expect(html).toContain('data-testid="live-occupancy"');
  });

  it('there is no separate occupancy panel — the count lives in the on-field list header', () => {
    const html = renderToStaticMarkup(
      createElement(LivePanel, { freshness: { kind: 'live' }, slow: slowModel(), fast: emptyFast }),
    );
    const onFieldPanelStart = html.indexOf('data-testid="live-list-on-field"');
    const onFieldPanelEnd = html.indexOf('data-testid="live-list-recovering"');
    const occupancyIndex = html.indexOf('data-testid="live-occupancy"');
    expect(occupancyIndex).toBeGreaterThan(onFieldPanelStart);
    expect(occupancyIndex).toBeLessThan(onFieldPanelEnd);
  });

  it('renders occupied against the field size when the field size is known', () => {
    const html = renderToStaticMarkup(
      createElement(LivePanel, {
        freshness: { kind: 'live' },
        slow: slowModel({ occupancy: { occupied: 2, fieldSize: 5 } }),
        fast: emptyFast,
      }),
    );
    expect(html).toMatch(/data-testid="live-occupancy"[^>]*>2\/5</);
  });

  it('renders occupied-only, never "occupied/undefined", when the field size was never sent', () => {
    const html = renderToStaticMarkup(
      createElement(LivePanel, {
        freshness: { kind: 'live' },
        slow: slowModel({ occupancy: { occupied: 3 } }),
        fast: emptyFast,
      }),
    );
    expect(html).toMatch(/data-testid="live-occupancy"[^>]*>3</);
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('3/');
  });

  it('renders every hero exactly where the classifier put it, in the order given', () => {
    const slow = slowModel({
      onField: [{ id: 'f1' }, { id: 'f2' }],
      recovering: [{ id: 'r1' }],
      queued: [{ id: 'q1' }],
      benched: [{ id: 'b1' }],
    });
    const html = renderToStaticMarkup(createElement(LivePanel, { freshness: { kind: 'live' }, slow, fast: emptyFast }));
    expect(html).toContain('data-testid="live-hero-row-f1"');
    expect(html).toContain('data-testid="live-hero-row-f2"');
    expect(html.indexOf('live-hero-row-f1')).toBeLessThan(html.indexOf('live-hero-row-f2'));
    expect(html).toContain('data-testid="live-hero-row-r1"');
    expect(html).toContain('data-testid="live-hero-row-q1"');
    expect(html).toContain('data-testid="live-hero-row-b1"');
  });

  it('an on-field hero with no matching fast countdown renders the missing-data string, not a substituted 0', () => {
    const slow = slowModel({ onField: [{ id: 'f1' }] });
    const html = renderToStaticMarkup(createElement(LivePanel, { freshness: { kind: 'live' }, slow, fast: emptyFast }));
    expect(html).toContain(en.fidelityStatusMissing);
  });

  it('an on-field hero with a matching fast countdown renders the formatted number', () => {
    const slow = slowModel({ onField: [{ id: 'f1' }] });
    const fast: LiveFastModel = { field: { f1: { heroId: 'f1', secondsRemaining: 30, basis: 'observed' } }, recovery: {} };
    const html = renderToStaticMarkup(createElement(LivePanel, { freshness: { kind: 'live' }, slow, fast }));
    expect(html).toContain('0:30');
  });

  it('renders the legend unconditionally, whether the currency is live or a gap', () => {
    const live = renderToStaticMarkup(
      createElement(LivePanel, { freshness: { kind: 'live' }, slow: slowModel(), fast: emptyFast }),
    );
    const gap = renderToStaticMarkup(
      createElement(LivePanel, {
        freshness: { kind: 'gap', reason: 'clientNotStreaming', actionable: false },
        slow: slowModel(),
        fast: emptyFast,
      }),
    );
    expect(live).toContain('data-testid="live-countdown-legend"');
    expect(gap).toContain('data-testid="live-countdown-legend"');
    expect(live).toContain(en.liveCountdownLegend);
    expect(gap).toContain(en.liveCountdownLegend);
  });

  it('omits the unclassified-count line when nothing was unclassified, but shows it when something was', () => {
    const none = renderToStaticMarkup(
      createElement(LivePanel, { freshness: { kind: 'live' }, slow: slowModel({ unclassifiedCount: 0 }), fast: emptyFast }),
    );
    const some = renderToStaticMarkup(
      createElement(LivePanel, { freshness: { kind: 'live' }, slow: slowModel({ unclassifiedCount: 2 }), fast: emptyFast }),
    );
    expect(none).not.toContain('data-testid="live-unclassified-count"');
    expect(some).toContain('data-testid="live-unclassified-count"');
  });

  it('omits the field-exit-pending line when nothing is pending, but shows it — with its own, non-alarming copy — when something is', () => {
    const none = renderToStaticMarkup(
      createElement(LivePanel, {
        freshness: { kind: 'live' },
        slow: slowModel({ fieldExitPendingCount: 0 }),
        fast: emptyFast,
      }),
    );
    const some = renderToStaticMarkup(
      createElement(LivePanel, {
        freshness: { kind: 'live' },
        slow: slowModel({ fieldExitPendingCount: 3 }),
        fast: emptyFast,
      }),
    );
    expect(none).not.toContain('data-testid="live-field-exit-pending-count"');
    expect(some).toContain('data-testid="live-field-exit-pending-count"');
    expect(some).not.toContain(en.liveUnclassifiedCount.replace('{n}', '3'));
  });
});
