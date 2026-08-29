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
// `diagnostics-section-wiring.test.tsx` does covers both. `sub()` and `copyVariants()` stay the real
// implementations (`importOriginal`) so the coverage-label, duration and bilingual-reservation
// assertions exercise genuine template substitution and genuine per-locale copy, not a stub.
vi.mock('../../lib/copy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/copy')>();
  return { ...actual, useCopy: () => en };
});

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
 * it — a depth counter over same/other tags between the opening tag and its matching close,
 * concatenating every text token found in between.
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
  it('with figures: the headline rates, current balance, and every block render, gold rate value carrying no unit', () => {
    const out = html(earnings());

    expect(cellText(out, 'live-earnings-gold-10')).toBe('100k');
    expect(cellText(out, 'live-earnings-gold-10-unit')).toBe(en.liveEarningsGoldHeadlineUnit);
    expect(cellText(out, 'live-earnings-xp-10')).toBe('5k');
    expect(cellText(out, 'live-earnings-xp-help-trigger')).toBe(en.liveEarningsXpHeadlineUnit);
    expect(cellText(out, 'live-earnings-gold-current')).toBe('12.3k');
    expect(cellText(out, 'live-earnings-gold-session-total')).toBe('75k');
    expect(cellText(out, 'live-earnings-xp-session-total')).toBe('3.8k');
    expect(cellText(out, 'live-earnings-elapsed')).toBe('5:00');
    expect(cellText(out, 'live-earnings-gold-session')).toBe('90k');
    expect(cellText(out, 'live-earnings-xp-session')).toBe('4.5k');
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
    // Elapsed is a duration, not a measured rate — it reads 0:00, never an em dash, even with no
    // earnings at all.
    expect(cellText(out, 'live-earnings-elapsed')).toBe('0:00');
  });

  it('a null carried on only some fields still renders an em dash for exactly those, real numbers for the rest', () => {
    const out = html(earnings({ gold10: null, xpSession: null, goldSessionTotal: null }));

    expect(cellText(out, 'live-earnings-gold-10')).toBe('—');
    expect(cellText(out, 'live-earnings-xp-session')).toBe('—');
    expect(cellText(out, 'live-earnings-gold-session-total')).toBe('—');
    expect(cellText(out, 'live-earnings-gold-session')).toBe('90k');
    expect(cellText(out, 'live-earnings-xp-10')).toBe('5k');
    expect(cellText(out, 'live-earnings-xp-session-total')).toBe('3.8k');
  });
});

describe('EarningsPanel — the two rate values carry no /h suffix, unlike their labels', () => {
  it('the rate values are bare numbers; the rate labels alone carry the per-hour marker', () => {
    const out = html(earnings());

    expect(cellText(out, 'live-earnings-gold-session')).not.toMatch(/\/h/);
    expect(cellText(out, 'live-earnings-xp-session')).not.toMatch(/\/h/);
    expect(out).toContain(en.liveEarningsGoldSessionLabel);
    expect(out).toContain(en.liveEarningsXpSessionLabel);
    expect(en.liveEarningsGoldSessionLabel).toMatch(/\/hr/);
    expect(en.liveEarningsXpSessionLabel).toMatch(/\/hr/);
  });

  it('the rate and total labels for gold are unmistakable from one another', () => {
    expect(en.liveEarningsGoldSessionLabel).not.toBe(en.liveEarningsGoldSessionTotalLabel);
    expect(en.liveEarningsGoldSessionLabel).toContain('/hr');
    expect(en.liveEarningsGoldSessionTotalLabel).not.toContain('/hr');
    expect(en.liveEarningsGoldSessionTotalLabel).toMatch(/total/i);
  });

  it('the rate and total labels for XP are unmistakable from one another', () => {
    expect(en.liveEarningsXpSessionLabel).not.toBe(en.liveEarningsXpSessionTotalLabel);
    expect(en.liveEarningsXpSessionLabel).toContain('/hr');
    expect(en.liveEarningsXpSessionTotalLabel).not.toContain('/hr');
    expect(en.liveEarningsXpSessionTotalLabel).toMatch(/total/i);
  });
});

describe('EarningsPanel — labels', () => {
  it('every block label reads its plain copy string', () => {
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
    // a digit boundary.
    expect(cellText(out, 'live-earnings-recent-window-label')).toBe('last 1 min');
    expect(out).toMatch(/aria-hidden="true" class="invisible[^"]*">last 10 min</);
  });

  it('carries no session-average readout — the dedicated session gold-rate block says that now', () => {
    const out = html(earnings({ goldSession: 90_000 }));
    expect(out).not.toContain('data-testid="live-earnings-session-average"');
    expect(out).not.toContain('session avg');
  });
});

describe('EarningsPanel — the left column reserves width for both languages, not just the active one', () => {
  it('the coverage label reserves against both languages\' longest form, even while only English is active', () => {
    const out = html(earnings({ coverageSeconds: 15 }));
    // English is the active/visible locale in every test here (mocked `useCopy`), but the
    // reservation must also hold the Portuguese longest form so switching languages later cannot
    // move the vertical rule.
    expect(out).toMatch(/aria-hidden="true" class="invisible[^"]*">últimos 10 min</);
  });

  it('the gold headline unit line reserves against both languages\' unit string', () => {
    const out = html(earnings());
    expect(cellText(out, 'live-earnings-gold-10-unit')).toBe(en.liveEarningsGoldHeadlineUnit);
    expect(out).toMatch(/aria-hidden="true" class="invisible[^"]*">ouro \/ h</);
  });
});

describe('EarningsPanel — the six blocks stay in the specified row-major order', () => {
  it('renders: current gold, session gold rate, session gold total, elapsed, session xp rate, session xp total', () => {
    const out = html(earnings());
    const order = [
      'live-earnings-gold-current',
      'live-earnings-gold-session',
      'live-earnings-gold-session-total',
      'live-earnings-elapsed',
      'live-earnings-xp-session',
      'live-earnings-xp-session-total',
    ];
    const positions = order.map((testId) => out.indexOf(`data-testid="${testId}"`));
    expect(positions.every((position) => position > -1)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

describe('EarningsPanel — every block value carries no fixed-width reservation of its own', () => {
  it('right alignment comes from the block container, not a per-value w-[Nch] box', () => {
    const out = html(earnings());

    for (const testId of [
      'live-earnings-gold-current',
      'live-earnings-gold-session-total',
      'live-earnings-xp-session-total',
      'live-earnings-elapsed',
      'live-earnings-gold-session',
      'live-earnings-xp-session',
    ]) {
      const valueTag = out.match(new RegExp(`<span[^>]*data-testid="${testId}"[^>]*>`))?.[0] ?? '';
      expect(valueTag).not.toMatch(/w-\[\d+ch\]/);
    }
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

describe('EarningsPanel — current gold and its age', () => {
  it('live: shows the tick balance, with no age beside it', () => {
    const out = html(earnings({ goldBalance: 42 }), LIVE);
    expect(cellText(out, 'live-earnings-gold-current')).toBe('42');
    expect(cellText(out, 'live-earnings-gold-current-age')).toBe('');
  });

  it('stale: the value and its age render as two separate elements, not one combined string', () => {
    const out = html(earnings({ goldBalance: 42 }), GAP);
    expect(cellText(out, 'live-earnings-gold-current')).toBe('42');
    expect(cellText(out, 'live-earnings-gold-current-age')).toBe('2m ago');
  });

  it('no data: an em dash for the value, and no fabricated age beside it', () => {
    const out = html(null, GAP);
    expect(cellText(out, 'live-earnings-gold-current')).toBe('—');
    expect(cellText(out, 'live-earnings-gold-current-age')).toBe('');
  });

  it('stored fallback: shows its own captured-at age even while the stream itself reports live', () => {
    const capturedAt = new Date(Date.now() - 10 * 60_000).toISOString();
    const out = html(earnings({ goldBalance: 42, goldBalanceCapturedAt: capturedAt }), LIVE);
    expect(cellText(out, 'live-earnings-gold-current')).toBe('42');
    expect(cellText(out, 'live-earnings-gold-current-age')).toBe('10m ago');
  });

  it('stored fallback takes precedence over the stream gap age when both are present', () => {
    const capturedAt = new Date(Date.now() - 10 * 60_000).toISOString();
    const out = html(earnings({ goldBalance: 42, goldBalanceCapturedAt: capturedAt }), GAP);
    expect(cellText(out, 'live-earnings-gold-current')).toBe('42');
    expect(cellText(out, 'live-earnings-gold-current-age')).toBe('10m ago');
  });

  it('fresh: a reading only seconds old shows no age at all — the "just now" case is suppressed', () => {
    const capturedAt = new Date(Date.now() - 5_000).toISOString();
    const out = html(earnings({ goldBalance: 42, goldBalanceCapturedAt: capturedAt }), LIVE);
    expect(cellText(out, 'live-earnings-gold-current')).toBe('42');
    expect(cellText(out, 'live-earnings-gold-current-age')).toBe('');
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
    expect(cellText(out, 'live-earnings-gold-current-age')).toBe('');
  });

  it("reserves an invisible sizer for the age's longest realistic form even while fresh and showing none", () => {
    const out = html(earnings({ goldBalance: 42 }), LIVE);
    expect(cellText(out, 'live-earnings-gold-current-age')).toBe('');
    // The sizer sits outside the tagged cell (a sibling), so it never pollutes `cellText` above.
    expect(out).toMatch(/aria-hidden="true" class="invisible[^"]*">23h ago<\/span>/);
  });

  it('reserves nothing on the age line when there is no balance to report at all', () => {
    const out = html(null, GAP);
    expect(out).not.toMatch(/>23h ago</);
  });

  it("the value's own box carries no age-sized reservation — its shape matches every other block", () => {
    const out = html(earnings({ goldBalance: 42 }), GAP);
    const valueTag = out.match(/<span[^>]*data-testid="live-earnings-gold-current"[^>]*>/)?.[0] ?? '';
    expect(valueTag).not.toMatch(/w-\[\d+ch\]/);
    expect(valueTag).not.toContain('relative grid');
  });
});

describe('EarningsPanel — the XP marker is always mounted and reachable', () => {
  it.each([
    ['live, with data', LIVE, earnings()] as const,
    ['not live, with a prior reading', GAP, earnings()] as const,
    ['no data at all', GAP, null] as const,
  ])(
    '%s: the "xp / h" trigger is in the DOM, keyboard-reachable, dotted-underlined, with no native tooltip',
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

describe('EarningsPanel — elapsed and reset', () => {
  it('the Elapsed block formats sessionSeconds with the shared live-duration formatter', () => {
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

describe('EarningsPanel — the right half is a fixed three-column, two-row grid', () => {
  it('lays the six blocks out three per row, with no per-block border box', () => {
    const out = html(earnings());
    expect(out).toContain('class="grid grid-cols-3 gap-x-4 gap-y-3"');
    expect(out).not.toContain('rounded-lg border');
  });

  it("a block's label is free to wrap onto a second line rather than truncating or overflowing its column — Portuguese's longer labels need it (docs/content-fit-ui.md rule 2)", () => {
    const out = html(earnings());
    const labelTag = out.match(/<span class="text-right text-\[10\.5px\] uppercase tracking-\[0\.06em\] text-muted">/);
    expect(labelTag).not.toBeNull();
    expect(labelTag?.[0]).not.toMatch(/whitespace-nowrap/);
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
