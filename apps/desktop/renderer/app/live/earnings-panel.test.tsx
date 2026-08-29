import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LiveEarnings } from '@bombfarm/contracts';
import { en } from '../../lib/copy/en';
import type { ReachedLiveFreshness } from './freshness-line';
import { EarningsPanel } from './earnings-panel';

// `useCopy()` is a hook, so it needs an active React dispatcher — fine for the `renderToStaticMarkup`
// calls below (a real render), but not for calling `EarningsPanel` directly as a plain function the
// way the reset-control wiring test at the bottom does. Mocking it the same way
// `diagnostics-section-wiring.test.tsx` does covers both: `renderToStaticMarkup` still renders real
// English copy, and the direct call no longer needs a dispatcher at all. `sub()` keeps its real
// interpolation so the coverage-label and duration assertions exercise the genuine template
// substitution, not a stub.
vi.mock('../../lib/copy', () => ({
  useCopy: () => en,
  sub: (template: string, values: Record<string, string | number>) =>
    template.replace(/\{(\w+)\}/g, (fallback: string, key: string) => String(values[key] ?? fallback)),
}));

const LIVE: ReachedLiveFreshness = { kind: 'live' };
const GAP: ReachedLiveFreshness = {
  kind: 'gap',
  reason: 'detached',
  actionable: true,
  sinceAt: new Date(Date.now() - 2 * 60_000).toISOString(),
};

function earnings(overrides: Partial<LiveEarnings> = {}): LiveEarnings {
  return {
    goldBalance: 12_345,
    goldBalanceCapturedAt: null,
    gold10: 100_000,
    goldSession: 90_000,
    xp10: 5_000,
    xpSession: 4_500,
    coverageSeconds: 120,
    sessionSeconds: 300,
    ...overrides,
  };
}

function html(data: LiveEarnings | null, freshness: ReachedLiveFreshness = LIVE) {
  return renderToStaticMarkup(createElement(EarningsPanel, { freshness, earnings: data, onReset: () => undefined }));
}

/**
 * Reads the full text content of the one element carrying `data-testid="{testId}"`, regardless of
 * what else is on the tag (class, other attributes, order) and regardless of markup nested inside
 * it (the rate cells nest a de-emphasised `/h` suffix span inside their value span) — a depth
 * counter over same/other tags between the opening tag and its matching close, concatenating every
 * text token found in between.
 */
function cellText(out: string, testId: string): string {
  const openTag = out.match(new RegExp(`<([a-zA-Z0-9]+)[^>]*data-testid="${testId}"[^>]*>`));
  if (!openTag) throw new Error(`no element with data-testid="${testId}" found in:\n${out}`);
  const tagName = openTag[1];
  const rest = out.slice((openTag.index ?? 0) + openTag[0].length);
  const tokenRe = /<\/([a-zA-Z0-9]+)[^>]*>|<([a-zA-Z0-9]+)[^>]*?(\/)?>|[^<]+/g;
  let depth = 0;
  let text = '';
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(rest))) {
    const [, closeName, openName, selfClose] = match;
    if (closeName) {
      if (depth === 0 && closeName === tagName) break;
      depth -= 1;
    } else if (openName) {
      if (!selfClose) depth += 1;
    } else {
      text += match[0];
    }
  }
  return text;
}

describe('EarningsPanel — every cell in every state', () => {
  it('with figures: the current balance and every rate render, rates carrying the /h suffix', () => {
    const out = html(earnings());

    expect(cellText(out, 'live-earnings-gold-current')).toBe('12.3k');
    expect(cellText(out, 'live-earnings-gold-10')).toBe('100k/h');
    expect(cellText(out, 'live-earnings-gold-session')).toBe('90k/h');
    expect(cellText(out, 'live-earnings-xp-10')).toBe('5k/h');
    expect(cellText(out, 'live-earnings-xp-session')).toBe('4.5k/h');
  });

  it('no data at all: every rate/balance position is an em dash, never 0', () => {
    const out = html(null, GAP);

    for (const testId of [
      'live-earnings-gold-current',
      'live-earnings-gold-10',
      'live-earnings-gold-session',
      'live-earnings-xp-10',
      'live-earnings-xp-session',
    ]) {
      expect(cellText(out, testId)).toBe('—');
    }
  });

  it('a null carried on only some fields still renders an em dash for exactly those, real numbers for the rest', () => {
    const out = html(earnings({ gold10: null, xpSession: null }));

    expect(cellText(out, 'live-earnings-gold-10')).toBe('—');
    expect(cellText(out, 'live-earnings-xp-session')).toBe('—');
    expect(cellText(out, 'live-earnings-gold-session')).toBe('90k/h');
    expect(cellText(out, 'live-earnings-xp-10')).toBe('5k/h');
  });
});

describe('EarningsPanel — labels', () => {
  it('the three static labels read the plain copy strings', () => {
    const out = html(earnings());

    expect(cellText(out, 'live-earnings-gold-current')).toBeTruthy();
    expect(out).toContain(en.liveEarningsCurrentGoldLabel);
    expect(out).toContain(en.liveEarningsGoldSessionLabel);
    expect(out).toContain(en.liveEarningsXpSessionLabel);
  });

  it.each([
    [15, 1],
    [59, 1],
    [125, 2],
    [600, 10],
    [700, 10],
  ])(
    'coverageSeconds=%d: both "last N min" labels state the true span, never a claimed 10 minutes they do not have',
    (coverageSeconds, minutes) => {
      const out = html(earnings({ coverageSeconds }));

      expect(cellText(out, 'live-earnings-gold-10-label')).toBe(`gold · last ${String(minutes)} min`);
      expect(cellText(out, 'live-earnings-xp-10-label')).toBe(`xp · last ${String(minutes)} min`);
    },
  );

  it('reserves space for the longest coverage form even while showing the shortest one', () => {
    const out = html(earnings({ coverageSeconds: 15 }));

    // The visible text is the short form ("last 1 min"), but an invisible sizer carrying the
    // longest realistic form ("last 10 min") is always mounted alongside it — that reservation,
    // not the visible text, is what keeps the cell from growing when real coverage passes a digit
    // boundary (see the `RecentLabel` comment in `earnings-panel.tsx`).
    expect(cellText(out, 'live-earnings-gold-10-label')).toBe('gold · last 1 min');
    expect(out).toMatch(/aria-hidden="true" class="invisible[^"]*">gold · last 10 min</);
    expect(out).toMatch(/aria-hidden="true" class="invisible[^"]*">xp · last 10 min</);
  });
});

describe('EarningsPanel — current gold and its age', () => {
  it('live: shows the tick balance, with no age attached', () => {
    const out = html(earnings({ goldBalance: 42 }), LIVE);
    expect(cellText(out, 'live-earnings-gold-current')).toBe('42');
  });

  it('stale: shows the last known balance together with a rendered age', () => {
    const out = html(earnings({ goldBalance: 42 }), GAP);
    expect(cellText(out, 'live-earnings-gold-current')).toBe('42 · 2m ago');
  });

  it('no data: an em dash, never a stale reading pinned to a fabricated age', () => {
    const out = html(null, GAP);
    expect(cellText(out, 'live-earnings-gold-current')).toBe('—');
  });

  it('stored fallback: shows its own captured-at age even while the stream itself reports live', () => {
    const capturedAt = new Date(Date.now() - 10 * 60_000).toISOString();
    const out = html(earnings({ goldBalance: 42, goldBalanceCapturedAt: capturedAt }), LIVE);
    expect(cellText(out, 'live-earnings-gold-current')).toBe('42 · 10m ago');
  });

  it('stored fallback takes precedence over the stream gap age when both are present', () => {
    const capturedAt = new Date(Date.now() - 10 * 60_000).toISOString();
    const out = html(earnings({ goldBalance: 42, goldBalanceCapturedAt: capturedAt }), GAP);
    expect(cellText(out, 'live-earnings-gold-current')).toBe('42 · 10m ago');
  });
});

describe('EarningsPanel — the XP marker is always mounted and reachable', () => {
  it.each([
    ['live, with data', LIVE, earnings()] as const,
    ['not live, with a prior reading', GAP, earnings()] as const,
    ['no data at all', GAP, null] as const,
  ])('%s: the help control is in the DOM, keyboard-reachable, with an accessible name', (_label, freshness, data) => {
    const out = html(data, freshness);
    const tagMatch = out.match(new RegExp(`<button[^>]*aria-label="${en.liveEarningsXpHelpLabel}"[^>]*>`));

    expect(tagMatch).not.toBeNull();
    const tag = tagMatch?.[0] ?? '';
    // Always mounted and interactive — never the sr-only-until-hover treatment: no real
    // `disabled` attribute and no negative tabIndex.
    expect(tag).not.toContain('disabled=');
    expect(tag).not.toContain('tabindex="-1"');
  });
});

describe('EarningsPanel — session duration and reset live in the header', () => {
  it('formats sessionSeconds with the shared live-duration formatter', () => {
    const out = html(earnings({ sessionSeconds: 90 }));
    expect(cellText(out, 'live-earnings-session-duration')).toBe('Session 1:30');
  });

  it('renders 0:00 rather than throwing before any tick has arrived', () => {
    const out = html(null);
    expect(cellText(out, 'live-earnings-session-duration')).toBe('Session 0:00');
  });

  it('renders a real reset button, icon-only with its accessible name from the copy layer', () => {
    const out = html(earnings());
    const tagMatch = out.match(/<button[^>]*data-testid="live-earnings-reset"[^>]*>([\s\S]*?)<\/button>/);

    expect(tagMatch).not.toBeNull();
    const [fullTag, inner] = tagMatch as unknown as [string, string];
    expect(fullTag).toContain(`aria-label="${en.liveEarningsResetAria}"`);
    // The icon inside stays decorative — it must not carry a second accessible name (no `label`
    // passed to `Icon`), or the button would end up with two conflicting accessible names.
    expect(inner).not.toContain('aria-label');
    expect(inner).not.toContain('role="img"');
  });
});

describe('EarningsPanel — the reset control invokes the bridge exactly once', () => {
  it('activating the rendered control calls onReset exactly once', () => {
    const onReset = vi.fn();
    const root = EarningsPanel({ freshness: LIVE, earnings: earnings(), onReset }) as unknown as {
      props: { children: unknown[] };
    };
    const header = root.props.children[0] as { props: { children: { props: { children: unknown[] } } } };
    const headerRight = header.props.children;
    const button = headerRight.props.children[1] as { props: { onClick: () => void; 'data-testid': string } };

    expect(button.props['data-testid']).toBe('live-earnings-reset');
    expect(button.props.onClick).toBe(onReset);

    button.props.onClick();
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
