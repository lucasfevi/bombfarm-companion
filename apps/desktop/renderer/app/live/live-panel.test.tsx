import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FIELD_SLOTS_MAX } from '@bombfarm/domain/casa-slots';
import { STRINGS, sub } from '../../lib/copy';
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
  it('carries the panel root testid, the freshness line, and the field occupancy count', () => {
    const html = renderToStaticMarkup(
      createElement(LivePanel, { freshness: { kind: 'live' }, slow: slowModel(), fast: emptyFast }),
    );
    expect(html).toContain('data-testid="live-panel"');
    expect(html).toContain('data-testid="live-freshness"');
    expect(html).toContain('data-testid="live-list-on-field-count"');
  });

  it('puts the earnings panel in the first column of a page-level two-column grid, with the heroes panel spanning full width outside it', () => {
    const html = renderToStaticMarkup(
      createElement(LivePanel, { freshness: { kind: 'live' }, slow: slowModel(), fast: emptyFast }),
    );
    const gridIndex = html.indexOf('class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"');
    const earningsIndex = html.indexOf('data-testid="live-earnings"');
    const heroesIndex = html.indexOf('data-testid="live-heroes"');

    expect(gridIndex).toBeGreaterThan(-1);
    expect(earningsIndex).toBeGreaterThan(gridIndex);
    expect(heroesIndex).toBeGreaterThan(earningsIndex);
  });

  it('has no separate House panel — every house reading it carried now heads the Resting section', () => {
    const slow = slowModel({
      recovering: [{ id: 'r1' }, { id: 'r2' }],
      house: { slots: 5, slotsMax: 9, cycleSeconds: 1050, rescuesLeft: 3, rescuesMax: 15 },
    });
    const html = renderToStaticMarkup(createElement(LivePanel, { freshness: { kind: 'live' }, slow, fast: emptyFast }));

    expect(html).not.toContain('data-testid="live-house"');
    expect(html).toMatch(/data-testid="live-list-recovering-count"[^>]*>2\/5</);
    expect(html).toContain(sub(en.liveRestingCycleValue, { duration: '17:30' }));
    expect(html).toContain(sub(en.liveRestingSkipsValue, { left: '3', max: '15' }));
    expect(html).toContain(en.liveRestingSlotsHint);
  });

  it('reads the day as spent rather than counting down to it — "no skips left", not "0 of 15"', () => {
    const slow = slowModel({ house: { slots: 9, slotsMax: 9, rescuesLeft: 0, rescuesMax: 15 } });
    const html = renderToStaticMarkup(createElement(LivePanel, { freshness: { kind: 'live' }, slow, fast: emptyFast }));

    expect(html).toContain(en.liveRestingSkipsNone);
    expect(html).not.toContain(sub(en.liveRestingSkipsValue, { left: '0', max: '15' }));
  });

  it('heads Resting with a plain count, and no facts at all, when the game has sent no house', () => {
    const slow = slowModel({ recovering: [{ id: 'r1', energyFraction: 0.5 }] });
    const html = renderToStaticMarkup(createElement(LivePanel, { freshness: { kind: 'live' }, slow, fast: emptyFast }));

    expect(html).toMatch(/data-testid="live-list-recovering-count"[^>]*>1</);
    expect(html).not.toContain('data-testid="live-list-recovering-facts"');
    expect(html).not.toContain('data-testid="live-list-recovering-hint"');
    // An absent house contributes nothing to the heading — never "1/" against an unknown cap.
    expect(html).not.toMatch(/data-testid="live-list-recovering-count"[^>]*>[^<]*\//);
  });

  it('gathers all four rotation states inside one Heroes panel, in field/resting/idle/benched order', () => {
    const html = renderToStaticMarkup(
      createElement(LivePanel, { freshness: { kind: 'live' }, slow: slowModel(), fast: emptyFast }),
    );
    const heroesPanel = html.indexOf('data-testid="live-heroes"');
    expect(heroesPanel).toBeGreaterThan(-1);
    expect(html).toContain(en.liveHeroesTitle);

    const sections = ['live-list-on-field', 'live-list-recovering', 'live-list-queued', 'live-list-benched'].map((testId) =>
      html.indexOf(`data-testid="${testId}"`),
    );
    expect(sections.every((index) => index > heroesPanel)).toBe(true);
    expect(sections).toEqual([...sections].sort((a, b) => a - b));
  });

  it('mutes the benched section and only the benched section — a hero out of the rotation reads differently from one resting inside it', () => {
    const slow = slowModel({ onField: [{ id: 'f1' }], recovering: [{ id: 'r1' }], queued: [{ id: 'q1' }], benched: [{ id: 'b1' }] });
    const html = renderToStaticMarkup(createElement(LivePanel, { freshness: { kind: 'live' }, slow, fast: emptyFast }));

    expect(html.match(/data-muted=""/g)).toHaveLength(1);
    const mutedIndex = html.indexOf('data-muted=""');
    expect(mutedIndex).toBeGreaterThan(html.indexOf('data-testid="live-list-benched"'));
  });

  it('there is no separate occupancy panel — the count lives in the on-field section heading', () => {
    const html = renderToStaticMarkup(
      createElement(LivePanel, { freshness: { kind: 'live' }, slow: slowModel(), fast: emptyFast }),
    );
    const onFieldPanelStart = html.indexOf('data-testid="live-list-on-field"');
    const onFieldPanelEnd = html.indexOf('data-testid="live-list-recovering"');
    const occupancyIndex = html.indexOf('data-testid="live-list-on-field-count"');
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
    expect(html).toMatch(/data-testid="live-list-on-field-count"[^>]*>2\/5</);
  });

  it('renders occupied-only, never "occupied/undefined", when the field size was never sent', () => {
    const html = renderToStaticMarkup(
      createElement(LivePanel, {
        freshness: { kind: 'live' },
        slow: slowModel({ occupancy: { occupied: 3 } }),
        fast: emptyFast,
      }),
    );
    expect(html).toMatch(/data-testid="live-list-on-field-count"[^>]*>3</);
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
    expect(html).toContain('data-testid="live-hero-card-f1"');
    expect(html).toContain('data-testid="live-hero-card-f2"');
    expect(html.indexOf('live-hero-card-f1')).toBeLessThan(html.indexOf('live-hero-card-f2'));
    expect(html).toContain('data-testid="live-hero-card-r1"');
    expect(html).toContain('data-testid="live-hero-card-q1"');
    expect(html).toContain('data-testid="live-hero-card-b1"');
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

  it('carries no countdown legend: every countdown reads the same, so there is no marking left to explain', () => {
    const html = renderToStaticMarkup(
      createElement(LivePanel, { freshness: { kind: 'live' }, slow: slowModel(), fast: emptyFast }),
    );
    expect(html).not.toContain('data-testid="live-countdown-legend"');
  });

  it('points at the skill tree only while the field is narrower than the game allows', () => {
    const narrow = renderToStaticMarkup(
      createElement(LivePanel, {
        freshness: { kind: 'live' },
        slow: slowModel({ occupancy: { occupied: 2, fieldSize: 5 } }),
        fast: emptyFast,
      }),
    );
    const full = renderToStaticMarkup(
      createElement(LivePanel, {
        freshness: { kind: 'live' },
        slow: slowModel({ occupancy: { occupied: 9, fieldSize: FIELD_SLOTS_MAX } }),
        fast: emptyFast,
      }),
    );
    expect(narrow).toContain('data-testid="live-list-on-field-hint"');
    expect(narrow).toContain(en.liveFieldSlotsHint);
    expect(full).not.toContain('data-testid="live-list-on-field-hint"');
  });

  it('withholds the hint when the field size was never sent — advice with no cap under it', () => {
    const html = renderToStaticMarkup(
      createElement(LivePanel, {
        freshness: { kind: 'live' },
        slow: slowModel({ occupancy: { occupied: 3 } }),
        fast: emptyFast,
      }),
    );
    expect(html).not.toContain('data-testid="live-list-on-field-hint"');
  });

  it('gives every hero an energy bar, in all four sections', () => {
    const slow = slowModel({
      onField: [{ id: 'f1', energyFraction: 0.8 }],
      recovering: [{ id: 'r1', energyFraction: 0.3 }],
      queued: [{ id: 'q1', energyFraction: 1 }],
      benched: [{ id: 'b1' }],
    });
    const html = renderToStaticMarkup(createElement(LivePanel, { freshness: { kind: 'live' }, slow, fast: emptyFast }));
    for (const id of ['f1', 'r1', 'q1', 'b1']) {
      expect(html).toContain(`data-testid="live-energy-${id}"`);
    }
  });

  it('tells a full idle hero from one still filling — the reading that makes one Idle section enough', () => {
    const slow = slowModel({ queued: [{ id: 'ready', energyFraction: 1 }, { id: 'waiting', energyFraction: 0.62 }] });
    const html = renderToStaticMarkup(createElement(LivePanel, { freshness: { kind: 'live' }, slow, fast: emptyFast }));
    expect(html).toMatch(/data-testid="live-energy-ready-value"[^>]*>100%</);
    expect(html).toMatch(/data-testid="live-energy-waiting-value"[^>]*>62%</);
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
