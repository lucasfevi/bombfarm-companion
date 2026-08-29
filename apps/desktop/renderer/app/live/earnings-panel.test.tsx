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
    goldSessionTotal: 75_000,
    xpSessionTotal: 3_750,
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

/**
 * Same tag/depth walk as {@link cellText}, but returns the raw markup between the opening and
 * closing tag instead of the flattened text — used to prove one element's subtree contains
 * another element's `data-testid`, regardless of how deeply it is nested inside.
 */
function innerHtml(out: string, testId: string): string {
  const openTag = out.match(new RegExp(`<([a-zA-Z0-9]+)[^>]*data-testid="${testId}"[^>]*>`));
  if (!openTag) throw new Error(`no element with data-testid="${testId}" found in:\n${out}`);
  const tagName = openTag[1];
  const start = (openTag.index ?? 0) + openTag[0].length;
  const rest = out.slice(start);
  const tokenRe = /<\/([a-zA-Z0-9]+)[^>]*>|<([a-zA-Z0-9]+)[^>]*?(\/)?>/g;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(rest))) {
    const [, closeName, openName, selfClose] = match;
    if (closeName) {
      if (depth === 0 && closeName === tagName) return rest.slice(0, match.index);
      depth -= 1;
    } else if (openName && !selfClose) {
      depth += 1;
    }
  }
  throw new Error(`no closing tag found for data-testid="${testId}"`);
}

/**
 * Walks the plain React-element tree `EarningsPanel(...)` returns when called directly as a
 * function (no dispatcher, no actual render) to find the one element carrying `data-testid`.
 * Independent of exactly how deep the control sits or how many wrapper elements surround it, so a
 * future layout change does not break this by shifting an index.
 */
function findElementByTestId(
  node: unknown,
  testId: string,
): { props: Record<string, unknown> } | null {
  if (node === null || typeof node !== 'object') return null;
  const element = node as { props?: Record<string, unknown> };
  if (element.props && element.props['data-testid'] === testId) {
    return element as { props: Record<string, unknown> };
  }
  const children = element.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findElementByTestId(child, testId);
      if (found) return found;
    }
    return null;
  }
  return findElementByTestId(children, testId);
}

describe('EarningsPanel — every cell in every state', () => {
  it('with figures: the headline rates, current balance, and every tile render, each with its own unit suffix', () => {
    const out = html(earnings());

    expect(cellText(out, 'live-earnings-gold-10')).toBe('100k gold / hr');
    expect(cellText(out, 'live-earnings-xp-10')).toBe('5k');
    expect(cellText(out, 'live-earnings-xp-help-trigger')).toBe(en.liveEarningsXpHeadlineUnit);
    expect(cellText(out, 'live-earnings-gold-current')).toBe('12.3k');
    expect(cellText(out, 'live-earnings-gold-session-total')).toBe('75k');
    expect(cellText(out, 'live-earnings-xp-session-total')).toBe('3.8k');
    expect(cellText(out, 'live-earnings-elapsed')).toBe('5:00');
    expect(cellText(out, 'live-earnings-gold-session')).toBe('90k/h');
    expect(cellText(out, 'live-earnings-xp-session')).toBe('4.5k/h');
  });

  it('no data at all: every rate/balance/total position is an em dash, never 0', () => {
    const out = html(null, GAP);

    for (const testId of [
      'live-earnings-gold-current',
      'live-earnings-gold-10',
      'live-earnings-gold-session',
      'live-earnings-gold-session-total',
      'live-earnings-xp-10',
      'live-earnings-xp-session',
      'live-earnings-xp-session-total',
    ]) {
      expect(cellText(out, testId)).toBe('—');
    }
    // Elapsed is a duration, not a measured rate — it reads 0:00 (see the dedicated test below),
    // never an em dash, even with no earnings at all.
    expect(cellText(out, 'live-earnings-elapsed')).toBe('0:00');
  });

  it('a null carried on only some fields still renders an em dash for exactly those, real numbers for the rest', () => {
    const out = html(earnings({ gold10: null, xpSession: null, goldSessionTotal: null }));

    expect(cellText(out, 'live-earnings-gold-10')).toBe('—');
    expect(cellText(out, 'live-earnings-xp-session')).toBe('—');
    expect(cellText(out, 'live-earnings-gold-session-total')).toBe('—');
    expect(cellText(out, 'live-earnings-gold-session')).toBe('90k/h');
    expect(cellText(out, 'live-earnings-xp-10')).toBe('5k');
    expect(cellText(out, 'live-earnings-xp-session-total')).toBe('3.8k');
  });
});

describe('EarningsPanel — labels', () => {
  it('every tile label reads its plain copy string', () => {
    const out = html(earnings());

    expect(out).toContain(en.liveEarningsCurrentGoldLabel);
    expect(out).toContain(en.liveEarningsGoldSessionTotalLabel);
    expect(out).toContain(en.liveEarningsElapsedLabel);
    expect(out).toContain(en.liveEarningsXpSessionTotalLabel);
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
    'coverageSeconds=%d: the "last N min" context line states the true span, never a claimed 10 minutes it does not have',
    (coverageSeconds, minutes) => {
      const out = html(earnings({ coverageSeconds }));

      expect(cellText(out, 'live-earnings-recent-window-label')).toBe(`last ${String(minutes)} min`);
    },
  );

  it('reserves space for the longest coverage form even while showing the shortest one', () => {
    const out = html(earnings({ coverageSeconds: 15 }));

    // The visible text is the short form ("last 1 min"), but an invisible sizer carrying the
    // longest realistic form ("last 10 min") is always mounted alongside it — that reservation,
    // not the visible text, is what keeps the context line from growing when real coverage passes
    // a digit boundary (see the `RecentWindowLabel` comment in `earnings-panel.tsx`).
    expect(cellText(out, 'live-earnings-recent-window-label')).toBe('last 1 min');
    expect(out).toMatch(/aria-hidden="true" class="invisible[^"]*">last 10 min</);
  });

  it('the context line also states the session average rate', () => {
    const out = html(earnings({ goldSession: 90_000 }));
    expect(cellText(out, 'live-earnings-session-average')).toBe('session avg 90k/h');
  });

  it('the session average reads an em dash rather than a fabricated rate when there is nothing to report', () => {
    const out = html(earnings({ goldSession: null }));
    expect(cellText(out, 'live-earnings-session-average')).toBe('session avg —');
  });
});

describe('EarningsPanel — the headline figures reserve their own width', () => {
  it('the two headline rates and the session-average readout sit in a fixed, right-aligned box — the tiles below do not', () => {
    const out = html(earnings());

    // Sized from `formatCompactNumber`'s widest realistic output ("999.9m") — gold-10, xp-10,
    // and the session-average figure share it because they sit mid-sentence in a horizontal row.
    // The six tiles below deliberately do not: each tile's value is the only, right-aligned thing
    // in its own box, so a growing number has nothing to push.
    const compactBoxes = out.match(/class="inline-block w-\[6ch\] text-right tabular-nums"/g) ?? [];
    expect(compactBoxes.length).toBe(3);
    expect(out).not.toMatch(/w-\[8ch\]/);
  });

  it('still reserves exactly the same three boxes for the null/em-dash state', () => {
    const out = html(null, GAP);
    const compactBoxes = out.match(/class="inline-block w-\[6ch\] text-right tabular-nums"/g) ?? [];
    expect(compactBoxes.length).toBe(3);
  });
});

describe('EarningsPanel — every tile value is right-aligned to the tile edge, with no per-tile width box', () => {
  it('every tile value sits directly inside a right-aligned, full-width, no-fixed-box wrapper', () => {
    const out = html(earnings());

    for (const testId of [
      'live-earnings-gold-current',
      'live-earnings-gold-session-total',
      'live-earnings-xp-session-total',
      'live-earnings-elapsed',
      'live-earnings-gold-session',
      'live-earnings-xp-session',
    ]) {
      const wrapperPattern = new RegExp(
        `<span class="[^"]*\\bblock\\b[^"]*\\btext-right\\b[^"]*\\btabular-nums\\b[^"]*"[^>]*><span[^>]*data-testid="${testId}"`,
      );
      expect(out).toMatch(wrapperPattern);
      const wrapperTag = out.match(new RegExp(`<span class="[^"]*"[^>]*><span[^>]*data-testid="${testId}"`))?.[0] ?? '';
      expect(wrapperTag).not.toMatch(/w-\[\d+ch\]/);
    }
  });

  it('a rate tile keeps its unit suffix glued to the digits rather than pinned to the tile edge on its own', () => {
    const out = html(earnings());
    expect(cellText(out, 'live-earnings-gold-session')).toBe('90k/h');
    expect(innerHtml(out, 'live-earnings-gold-session')).toMatch(/^90k<span[^>]*>\/h<\/span>$/);
  });
});

describe('EarningsPanel — the panel keeps an accessible name without a visible title', () => {
  it('renders no visible heading, but names the landmark via aria-label with the same copy', () => {
    const out = html(earnings());

    expect(out).not.toContain('<h2');
    expect(out).not.toMatch(/>\s*Earnings\s*</);
    const sectionMatch = out.match(/<section[^>]*data-testid="live-earnings"[^>]*>/);
    expect(sectionMatch).not.toBeNull();
    expect(sectionMatch?.[0]).toContain(`aria-label="${en.liveEarningsTitle}"`);
  });
});

describe('EarningsPanel — the two headline figures share one baseline', () => {
  it('the gold and xp headline values are children of one items-baseline container', () => {
    const out = html(earnings());
    const openTagMatch = out.match(/<div[^>]*data-testid="live-earnings-headline-baseline"[^>]*>/);
    expect(openTagMatch).not.toBeNull();
    expect(openTagMatch?.[0]).toMatch(/class="[^"]*items-baseline[^"]*"/);

    const baselineHtml = innerHtml(out, 'live-earnings-headline-baseline');
    expect(baselineHtml).toContain('data-testid="live-earnings-gold-10"');
    expect(baselineHtml).toContain('data-testid="live-earnings-xp-10"');
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

  it('fresh: a reading only seconds old shows no age at all — the "just now" case is suppressed', () => {
    const capturedAt = new Date(Date.now() - 5_000).toISOString();
    const out = html(earnings({ goldBalance: 42, goldBalanceCapturedAt: capturedAt }), LIVE);
    expect(cellText(out, 'live-earnings-gold-current')).toBe('42');
  });

  it('fresh via the stream gap too: a just-lost tick reads no age either', () => {
    const freshGap: ReachedLiveFreshness = {
      kind: 'gap',
      reason: 'detached',
      actionable: true,
      sinceAt: new Date(Date.now() - 5_000).toISOString(),
    };
    const out = html(earnings({ goldBalance: 42 }), freshGap);
    expect(cellText(out, 'live-earnings-gold-current')).toBe('42');
  });

  it('reserves an invisible sizer for the widest realistic number-plus-age combination even while fresh and showing no age', () => {
    const out = html(earnings({ goldBalance: 42 }), LIVE);
    expect(cellText(out, 'live-earnings-gold-current')).toBe('42');
    // The sizer sits outside the tagged cell (a sibling), so it never pollutes `cellText` above.
    expect(out).toMatch(/aria-hidden="true" class="invisible[^"]*"><span[^>]*>999\.9m · 23h ago<\/span>/);
  });

  it('reserves nothing when there is no balance to report at all', () => {
    const out = html(null, GAP);
    expect(out).not.toMatch(/>999\.9m/);
  });
});

describe('EarningsPanel — the XP marker is always mounted and reachable', () => {
  it.each([
    ['live, with data', LIVE, earnings()] as const,
    ['not live, with a prior reading', GAP, earnings()] as const,
    ['no data at all', GAP, null] as const,
  ])(
    '%s: the "xp / hr" trigger is in the DOM, keyboard-reachable, dotted-underlined, with no native tooltip',
    (_label, freshness, data) => {
      const out = html(data, freshness);
      const tagMatch = out.match(/<button[^>]*data-testid="live-earnings-xp-help-trigger"[^>]*>/);

      expect(tagMatch).not.toBeNull();
      const tag = tagMatch?.[0] ?? '';
      expect(tag).toContain(`aria-label="${en.liveEarningsXpHeadlineUnit}: ${en.liveEarningsXpHelpBody}"`);
      expect(tag).toMatch(/class="[^"]*\bunderline\b[^"]*\bdecoration-dotted\b[^"]*"/);
      // Always mounted and interactive — never the sr-only-until-hover treatment: no real
      // `disabled` attribute and no negative tabIndex.
      expect(tag).not.toContain('disabled=');
      expect(tag).not.toContain('tabindex="-1"');
      // The old `?` control set BOTH an `aria-label` and a native `title` — a duplicate,
      // competing hover tooltip. Only the ARIA one may remain.
      expect(tag).not.toContain('title=');
    },
  );

  it('carries the real help copy, reachable through the trigger (Base UI mounts the popup only once open, so this reads the unrendered element tree rather than static markup)', () => {
    const root = EarningsPanel({ freshness: LIVE, earnings: earnings(), onReset: () => undefined });
    const body = findElementByTestId(root, 'live-earnings-xp-help-body');
    expect(body?.props.children).toBe(en.liveEarningsXpHelpBody);
  });
});

describe('EarningsPanel — elapsed and reset live in the headline band', () => {
  it('the Elapsed tile formats sessionSeconds with the shared live-duration formatter', () => {
    const out = html(earnings({ sessionSeconds: 90 }));
    expect(cellText(out, 'live-earnings-elapsed')).toBe('1:30');
  });

  it('renders 0:00 rather than throwing before any tick has arrived', () => {
    const out = html(null);
    expect(cellText(out, 'live-earnings-elapsed')).toBe('0:00');
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
    const root = EarningsPanel({ freshness: LIVE, earnings: earnings(), onReset });
    const button = findElementByTestId(root, 'live-earnings-reset') as {
      props: { onClick: () => void; 'data-testid': string };
    } | null;

    expect(button).not.toBeNull();
    expect(button?.props['data-testid']).toBe('live-earnings-reset');

    button?.props.onClick();
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
