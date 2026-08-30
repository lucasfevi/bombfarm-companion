import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FIELD_SLOTS_MAX } from '@bombfarm/domain/casa-slots';
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

const emptyFast: LiveFastModel = { field: {}, recovery: {}, energy: {} };

describe('LivePanel — composition', () => {
  it('carries the panel root testid, the freshness line, and the field occupancy count', () => {
    const html = renderToStaticMarkup(
      createElement(LivePanel, { freshness: { kind: 'live' }, slow: slowModel(), fast: emptyFast }),
    );
    expect(html).toContain('data-testid="live-panel"');
    expect(html).toContain('data-testid="live-freshness"');
    expect(html).toContain('data-testid="live-state-summary-on-field-count"');
  });

  it('puts the earnings panel in the first column of a page-level two-column grid, with the heroes panel spanning full width outside it', () => {
    const html = renderToStaticMarkup(
      createElement(LivePanel, { freshness: { kind: 'live' }, slow: slowModel(), fast: emptyFast }),
    );
    const gridIndex = html.indexOf('class="grid grid-cols-1 gap-4 min-[1334px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"');
    const earningsIndex = html.indexOf('data-testid="live-earnings"');
    const heroesIndex = html.indexOf('data-testid="live-heroes"');

    expect(gridIndex).toBeGreaterThan(-1);
    expect(earningsIndex).toBeGreaterThan(gridIndex);
    expect(heroesIndex).toBeGreaterThan(earningsIndex);
  });

  it('has no separate House panel — every house reading it carried now feeds the Resting tooltip', () => {
    const slow = slowModel({
      recovering: [{ id: 'r1' }, { id: 'r2' }],
      house: { slots: 5, slotsMax: 9, cycleSeconds: 1050, rescuesLeft: 3, rescuesMax: 15 },
    });
    const html = renderToStaticMarkup(createElement(LivePanel, { freshness: { kind: 'live' }, slow, fast: emptyFast }));

    expect(html).not.toContain('data-testid="live-house"');
    expect(html).toMatch(/data-testid="live-state-summary-recovering-count"[^>]*>2\/5</);
    // A real house reading turns the plain count into a tooltip trigger — the exact fact/hint
    // text this feeds is `state-summary-bar.test.tsx`'s job and `resting-facts.test.ts`'s for the
    // underlying "no skips left" vs "0 of 15" wording; Base UI mounts the popup only once open,
    // so its content is not in this static render at all.
    expect(html).toMatch(/<button[^>]*data-testid="live-state-summary-recovering"[^>]*>/);
  });

  it('shows the resting count plain, with no tooltip trigger at all, when the game has sent no house', () => {
    const slow = slowModel({ recovering: [{ id: 'r1', energyFraction: 0.5 }] });
    const html = renderToStaticMarkup(createElement(LivePanel, { freshness: { kind: 'live' }, slow, fast: emptyFast }));

    expect(html).toMatch(/data-testid="live-state-summary-recovering-count"[^>]*>1</);
    const tagMatch = html.match(/<[a-z]+[^>]*data-testid="live-state-summary-recovering"[^>]*>/);
    expect(tagMatch?.[0]).not.toMatch(/^<button/);
    // An absent house contributes nothing to the count — never "1/" against an unknown cap.
    expect(html).not.toMatch(/data-testid="live-state-summary-recovering-count"[^>]*>[^<]*\//);
  });

  it('gathers all four rotation states inside one flat list, in field/resting/idle/benched order — the classifier\'s own within-group order preserved', () => {
    const slow = slowModel({
      onField: [{ id: 'f1' }, { id: 'f2' }],
      recovering: [{ id: 'r1' }, { id: 'r2' }],
      queued: [{ id: 'q1' }, { id: 'q2' }],
      benched: [{ id: 'b1' }, { id: 'b2' }],
    });
    const html = renderToStaticMarkup(createElement(LivePanel, { freshness: { kind: 'live' }, slow, fast: emptyFast }));
    const heroesPanel = html.indexOf('data-testid="live-heroes"');
    expect(heroesPanel).toBeGreaterThan(-1);
    expect(html).toContain(en.liveHeroesTitle);

    const ids = ['f1', 'f2', 'r1', 'r2', 'q1', 'q2', 'b1', 'b2'];
    const positions = ids.map((id) => html.indexOf(`data-testid="live-hero-row-${id}"`));
    expect(positions.every((index) => index > heroesPanel)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('mutes the benched rows and only the benched rows — a hero out of the rotation reads differently from one resting inside it', () => {
    const slow = slowModel({ onField: [{ id: 'f1' }], recovering: [{ id: 'r1' }], queued: [{ id: 'q1' }], benched: [{ id: 'b1' }] });
    const html = renderToStaticMarkup(createElement(LivePanel, { freshness: { kind: 'live' }, slow, fast: emptyFast }));

    expect(html.match(/data-muted=""/g)).toHaveLength(1);
    const mutedIndex = html.indexOf('data-muted=""');
    expect(mutedIndex).toBeGreaterThan(html.indexOf('data-testid="live-hero-row-b1"'));
    expect(mutedIndex).toBeLessThan(html.indexOf('data-testid="live-hero-row-b1-name"'));
  });

  it('there is no separate occupancy panel — the count lives in the summary bar', () => {
    const html = renderToStaticMarkup(
      createElement(LivePanel, { freshness: { kind: 'live' }, slow: slowModel(), fast: emptyFast }),
    );
    const summaryIndex = html.indexOf('data-testid="live-state-summary"');
    const listIndex = html.indexOf('data-testid="live-hero-list-empty"');
    const occupancyIndex = html.indexOf('data-testid="live-state-summary-on-field-count"');
    expect(occupancyIndex).toBeGreaterThan(summaryIndex);
    expect(occupancyIndex).toBeLessThan(listIndex);
  });

  it('renders occupied against the field size when the field size is known', () => {
    const html = renderToStaticMarkup(
      createElement(LivePanel, {
        freshness: { kind: 'live' },
        slow: slowModel({ occupancy: { occupied: 2, fieldSize: 5 } }),
        fast: emptyFast,
      }),
    );
    expect(html).toMatch(/data-testid="live-state-summary-on-field-count"[^>]*>2\/5</);
  });

  it('renders occupied-only, never "occupied/undefined", when the field size was never sent', () => {
    const html = renderToStaticMarkup(
      createElement(LivePanel, {
        freshness: { kind: 'live' },
        slow: slowModel({ occupancy: { occupied: 3 } }),
        fast: emptyFast,
      }),
    );
    expect(html).toMatch(/data-testid="live-state-summary-on-field-count"[^>]*>3</);
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

  it('an empty account still renders the list\'s own empty line rather than vanishing silently', () => {
    const html = renderToStaticMarkup(
      createElement(LivePanel, { freshness: { kind: 'live' }, slow: slowModel(), fast: emptyFast }),
    );
    expect(html).toContain('data-testid="live-hero-list-empty"');
    expect(html).toContain(en.liveListEmptyLine);
    expect(html).not.toContain('data-testid="live-hero-list"');
  });

  it('renders the list, not the empty line, once any group has a hero', () => {
    const html = renderToStaticMarkup(
      createElement(LivePanel, { freshness: { kind: 'live' }, slow: slowModel({ queued: [{ id: 'q1' }] }), fast: emptyFast }),
    );
    expect(html).toContain('data-testid="live-hero-list"');
    expect(html).not.toContain('data-testid="live-hero-list-empty"');
  });

  it('an on-field hero with no matching fast countdown renders the missing-data string, not a substituted 0', () => {
    const slow = slowModel({ onField: [{ id: 'f1' }] });
    const html = renderToStaticMarkup(createElement(LivePanel, { freshness: { kind: 'live' }, slow, fast: emptyFast }));
    expect(html).toContain(en.valueNotAvailable);
  });

  it('an on-field hero with a matching fast countdown renders the formatted number', () => {
    const slow = slowModel({ onField: [{ id: 'f1' }] });
    const fast: LiveFastModel = { field: { f1: { heroId: 'f1', secondsRemaining: 30, basis: 'observed' } }, recovery: {}, energy: {} };
    const html = renderToStaticMarkup(createElement(LivePanel, { freshness: { kind: 'live' }, slow, fast }));
    expect(html).toContain('0:30');
  });

  it('renders a countdown for an on-field row and a recovering row, and none at all for idle/benched', () => {
    const slow = slowModel({
      onField: [{ id: 'f1' }],
      recovering: [{ id: 'r1' }],
      queued: [{ id: 'q1' }],
      benched: [{ id: 'b1' }],
    });
    const fast: LiveFastModel = {
      field: { f1: { heroId: 'f1', secondsRemaining: 30, basis: 'observed' } },
      recovery: { r1: { heroId: 'r1', secondsRemaining: 45, advancing: true } },
      energy: {},
    };
    const html = renderToStaticMarkup(createElement(LivePanel, { freshness: { kind: 'live' }, slow, fast }));
    expect(html).toContain('data-testid="live-countdown-field-f1"');
    expect(html).toContain('data-testid="live-countdown-recovery-r1"');
    expect(html).not.toContain('data-testid="live-countdown-field-q1"');
    expect(html).not.toContain('data-testid="live-countdown-recovery-q1"');
    expect(html).not.toContain('data-testid="live-countdown-field-b1"');
    expect(html).not.toContain('data-testid="live-countdown-recovery-b1"');
  });

  it('carries no countdown legend: every countdown reads the same, so there is no marking left to explain', () => {
    const html = renderToStaticMarkup(
      createElement(LivePanel, { freshness: { kind: 'live' }, slow: slowModel(), fast: emptyFast }),
    );
    expect(html).not.toContain('data-testid="live-countdown-legend"');
  });

  it('surfaces the skill-tree hint through the on-field tooltip trigger only while the field is narrower than the game allows', () => {
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
    expect(narrow).toMatch(/<button[^>]*data-testid="live-state-summary-on-field"[^>]*>/);
    const fullTag = full.match(/<[a-z]+[^>]*data-testid="live-state-summary-on-field"[^>]*>/);
    expect(fullTag?.[0]).not.toMatch(/^<button/);
  });

  it('withholds the on-field tooltip when the field size was never sent — advice with no cap under it', () => {
    const html = renderToStaticMarkup(
      createElement(LivePanel, {
        freshness: { kind: 'live' },
        slow: slowModel({ occupancy: { occupied: 3 } }),
        fast: emptyFast,
      }),
    );
    const tagMatch = html.match(/<[a-z]+[^>]*data-testid="live-state-summary-on-field"[^>]*>/);
    expect(tagMatch?.[0]).not.toMatch(/^<button/);
  });

  it('gives every hero an energy bar, in all four states', () => {
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

  it('tells a full idle hero from one still filling — the reading that makes one flat list enough', () => {
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

describe('LivePanel — the energy reading follows the fast channel, not the rotation snapshot', () => {
  function readPercent(html: string, id: string): string | undefined {
    return new RegExp(`data-testid="live-energy-${id}-value"[^>]*>([^<]*)<`).exec(html)?.[1];
  }

  it('a recovering hero whose countdown is spent reads full, not the figure the snapshot was read at', () => {
    // The reported defect: the rotation snapshot is up to an authenticated cycle old, so its 99%
    // outlives the rest it described. The fast channel says the rest is over; the row must agree
    // with the clock printed beside it.
    const slow = slowModel({ recovering: [{ id: 'devin', energyFraction: 0.99 }] });
    const fast: LiveFastModel = {
      field: {},
      recovery: { devin: { heroId: 'devin', secondsRemaining: 0, advancing: true } },
      energy: { devin: 1 },
    };

    const html = renderToStaticMarkup(createElement(LivePanel, { freshness: { kind: 'live' }, slow, fast }));

    expect(html).toContain('0:00');
    expect(readPercent(html, 'devin')).toBe('100%');
  });

  it('an on-field hero shows the energy the tap observed rather than the snapshot it was joined against', () => {
    const slow = slowModel({ onField: [{ id: 'f1', energyFraction: 0.9 }] });
    const fast: LiveFastModel = { field: {}, recovery: {}, energy: { f1: 0.42 } };

    const html = renderToStaticMarkup(createElement(LivePanel, { freshness: { kind: 'live' }, slow, fast }));

    expect(readPercent(html, 'f1')).toBe('42%');
  });

  it('a queued or benched hero keeps the snapshot figure — the fast channel reaches neither', () => {
    const slow = slowModel({
      queued: [{ id: 'q1', energyFraction: 0.62 }],
      benched: [{ id: 'b1', energyFraction: 0.5 }],
    });
    const fast: LiveFastModel = { field: {}, recovery: {}, energy: {} };

    const html = renderToStaticMarkup(createElement(LivePanel, { freshness: { kind: 'live' }, slow, fast }));

    expect(readPercent(html, 'q1')).toBe('62%');
    expect(readPercent(html, 'b1')).toBe('50%');
  });

  it('a hero the fast channel has no reading for keeps the snapshot figure rather than falling to zero', () => {
    const slow = slowModel({ onField: [{ id: 'f1', energyFraction: 0.77 }] });
    const fast: LiveFastModel = { field: {}, recovery: {}, energy: { someone_else: 0.1 } };

    const html = renderToStaticMarkup(createElement(LivePanel, { freshness: { kind: 'live' }, slow, fast }));

    expect(readPercent(html, 'f1')).toBe('77%');
  });
});
