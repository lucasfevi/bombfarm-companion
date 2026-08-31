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
  // `useLocale()` is stubbed for the same reason and in the same place: the panel reads the
  // language to format its figures, and the direct-call test has no dispatcher for a hook.
  return { ...actual, useCopy: () => en, useLocale: () => ({ locale: 'en', lang: 'en', bcp47: 'en-US' }) };
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
    gold10Series: [90_000, 110_000, 100_000],
    goldPerProp10: 180,
    propsPerMinute10: 110,
    propsSessionTotal: 420,
    coverageSeconds: 120,
    sessionSeconds: 300,
    ...overrides,
  };
}

function html(
  data: LiveEarnings | null,
  freshness: ReachedLiveFreshness = LIVE,
  goldPerPropDelta: number | null = null,
) {
  return renderToStaticMarkup(
    createElement(EarningsPanel, { freshness, earnings: data, goldPerPropDelta, onReset: () => undefined }),
  );
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
 * The component behind an element, whether it was written plainly or wrapped in `memo`. `memo`
 * stores the real function one level down, on `type.type`.
 */
function componentOf(element: { type?: unknown }): ((props: unknown) => unknown) | null {
  const { type } = element;
  if (typeof type === 'function') return type as (props: unknown) => unknown;
  if (type !== null && typeof type === 'object') {
    const inner = (type as { type?: unknown }).type;
    if (typeof inner === 'function') return inner as (props: unknown) => unknown;
  }
  return null;
}

/**
 * Walks the plain React-element tree `EarningsPanel(...)` returns when called directly as a
 * function (no dispatcher, no actual render) to find the one element carrying `data-testid`.
 * Independent of exactly how deep the control sits or how many wrapper elements surround it, and
 * of whether it is reached through `children` or through some other prop (`Block`'s own `value`,
 * for the current-gold marker below).
 *
 * A component element whose props hold nothing matching is expanded by CALLING it, so that pulling
 * a piece of this panel out into its own component (`XpHeadlineHelp`) does not silently put the
 * thing being searched for out of reach — which is exactly what a testid search finding nothing
 * would otherwise look like. Only as a fallback, and only when the props hold no match: components
 * that need a dispatcher (every Base UI part here does) throw when called this way, and their
 * children are already reachable through `props` without calling anything.
 */
function findElementByTestId(
  node: unknown,
  testId: string,
): { props: Record<string, unknown> } | null {
  if (node === null || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElementByTestId(child, testId);
      if (found) return found;
    }
    return null;
  }
  const element = node as { type?: unknown; props?: Record<string, unknown> };
  if (element.props && element.props['data-testid'] === testId) {
    return element as { props: Record<string, unknown> };
  }
  if (!element.props) return null;
  for (const value of Object.values(element.props)) {
    const found = findElementByTestId(value, testId);
    if (found) return found;
  }
  const component = componentOf(element);
  if (!component) return null;
  try {
    return findElementByTestId(component(element.props), testId);
  } catch {
    return null;
  }
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

  it('shows the short coverage form as plain text, growing no invisible sizer of its own — the fixed column already reserves the space', () => {
    const out = html(earnings({ coverageSeconds: 15 }));

    expect(cellText(out, 'live-earnings-recent-window-label')).toBe('last 1 min');
    expect(out).not.toMatch(/aria-hidden="true" class="invisible[^"]*">last 10 min/);
  });

  it('carries no session-average readout — the dedicated session gold-rate block says that now', () => {
    const out = html(earnings({ goldSession: 90_000 }));
    expect(out).not.toContain('data-testid="live-earnings-session-average"');
    expect(out).not.toContain('session avg');
  });
});

describe('EarningsPanel — the headline column is a fixed width, not sized to its content', () => {
  it('the column carries one explicit fixed width, shrink-proof against its flex sibling', () => {
    const out = html(earnings());
    expect(out).toContain('data-testid="live-earnings-headline-column"');
    expect(out).toContain(
      'class="flex w-[8rem] shrink-0 flex-col items-end gap-1.5 border-r border-line/55 pr-5"',
    );
  });

  it('the coverage label and both unit lines carry no per-line reservation of their own — the column width already covers it', () => {
    const out = html(earnings({ coverageSeconds: 15 }));
    expect(cellText(out, 'live-earnings-recent-window-label')).toBe('last 1 min');
    expect(cellText(out, 'live-earnings-gold-10-unit')).toBe(en.liveEarningsGoldHeadlineUnit);
    expect(out).not.toMatch(/aria-hidden="true" class="invisible[^"]*">(últimos|ouro)/);
  });

  it('the gold and xp headline figures carry no width reservation of their own — the column supplies it', () => {
    const out = html(earnings());
    const goldTag = out.match(/<span[^>]*data-testid="live-earnings-gold-10"[^>]*>/)?.[0] ?? '';
    const xpTag = out.match(/<span[^>]*data-testid="live-earnings-xp-10"[^>]*>/)?.[0] ?? '';

    for (const tag of [goldTag, xpTag]) {
      expect(tag).not.toMatch(/w-\[\d+ch\]/);
      expect(tag).not.toContain('relative grid');
    }
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

/**
 * The staleness marker's own `<button>` tag, by its dedicated testid — present in static markup
 * (unlike the tooltip popup it opens, which Base UI mounts only once open; see the XP marker's
 * own comment below for that same distinction).
 */
function goldAgeTriggerTag(out: string): string | null {
  return out.match(/<button[^>]*data-testid="live-earnings-gold-current-age-trigger"[^>]*>/)?.[0] ?? null;
}

/**
 * The tooltip popup's exact age text, read off the unrendered element tree the same way the XP
 * help body is below — Base UI never puts a closed popup's content into static markup.
 */
function goldAgeText(freshness: ReachedLiveFreshness, data: LiveEarnings | null): unknown {
  const root = EarningsPanel({ freshness, earnings: data, onReset: () => undefined });
  return findElementByTestId(root, 'live-earnings-gold-current-age')?.props.children;
}

describe('EarningsPanel — current gold and its staleness marker', () => {
  it('live: shows the tick balance in its normal gold color, marker hidden, no age to report', () => {
    const out = html(earnings({ goldBalance: 42 }), LIVE);
    expect(cellText(out, 'live-earnings-gold-current')).toBe('42');
    expect(out).toContain('<span class="text-gold">42</span>');
    const trigger = goldAgeTriggerTag(out);
    expect(trigger).toMatch(/class="invisible /);
    expect(goldAgeText(LIVE, earnings({ goldBalance: 42 }))).toBe('');
  });

  it('stale: the value itself mutes and the marker becomes visible, the exact age reachable through it — not one combined string with the value', () => {
    const out = html(earnings({ goldBalance: 42 }), GAP);
    expect(cellText(out, 'live-earnings-gold-current')).toBe('42');
    expect(out).toContain('<span class="text-muted">42</span>');
    const trigger = goldAgeTriggerTag(out);
    expect(trigger).not.toBeNull();
    expect(trigger).not.toMatch(/\binvisible\b/);
    expect(trigger).toContain('aria-label="Current gold: 2m ago"');
    expect(goldAgeText(GAP, earnings({ goldBalance: 42 }))).toBe('2m ago');
  });

  it('no data: an em dash for the value, marker stays hidden — no fabricated age beside a dash', () => {
    const out = html(null, GAP);
    expect(cellText(out, 'live-earnings-gold-current')).toBe('—');
    expect(goldAgeTriggerTag(out)).toMatch(/class="invisible /);
  });

  it('stored fallback: shows its own captured-at age even while the stream itself reports live', () => {
    const capturedAt = new Date(Date.now() - 10 * 60_000).toISOString();
    const data = earnings({ goldBalance: 42, goldBalanceCapturedAt: capturedAt });
    const out = html(data, LIVE);
    expect(cellText(out, 'live-earnings-gold-current')).toBe('42');
    expect(goldAgeTriggerTag(out)).not.toMatch(/\binvisible\b/);
    expect(goldAgeText(LIVE, data)).toBe('10m ago');
  });

  it('stored fallback takes precedence over the stream gap age when both are present', () => {
    const capturedAt = new Date(Date.now() - 10 * 60_000).toISOString();
    const data = earnings({ goldBalance: 42, goldBalanceCapturedAt: capturedAt });
    const out = html(data, GAP);
    expect(cellText(out, 'live-earnings-gold-current')).toBe('42');
    expect(goldAgeText(GAP, data)).toBe('10m ago');
  });

  it('fresh: a reading only seconds old shows no age at all, marker stays hidden — the "just now" case is suppressed', () => {
    const capturedAt = new Date(Date.now() - 5_000).toISOString();
    const data = earnings({ goldBalance: 42, goldBalanceCapturedAt: capturedAt });
    const out = html(data, LIVE);
    expect(cellText(out, 'live-earnings-gold-current')).toBe('42');
    expect(goldAgeTriggerTag(out)).toMatch(/class="invisible /);
    expect(goldAgeText(LIVE, data)).toBe('');
  });

  it('fresh via the stream gap too: a just-lost tick reads no age either, marker stays hidden', () => {
    const freshGap: ReachedLiveFreshness = {
      kind: 'gap',
      reason: 'detached',
      actionable: true,
      sinceAt: new Date(Date.now() - 5_000).toISOString(),
    };
    const out = html(earnings({ goldBalance: 42 }), freshGap);
    expect(cellText(out, 'live-earnings-gold-current')).toBe('42');
    expect(goldAgeTriggerTag(out)).toMatch(/class="invisible /);
  });

  it('the marker is always mounted — never conditionally rendered on staleness — across live, stale and no-data states, so its box can never differ between them', () => {
    for (const [freshness, data] of [
      [LIVE, earnings({ goldBalance: 42 })],
      [GAP, earnings({ goldBalance: 42 })],
      [GAP, null],
    ] as const) {
      const out = html(data, freshness);
      expect(goldAgeTriggerTag(out)).not.toBeNull();
    }
  });

  it("the value's own box carries no fixed-width reservation of its own — its shape matches every other block", () => {
    const out = html(earnings({ goldBalance: 42 }), GAP);
    const valueTag = out.match(/<span[^>]*data-testid="live-earnings-gold-current"[^>]*>/)?.[0] ?? '';
    expect(valueTag).not.toMatch(/w-\[\d+ch\]/);
    expect(valueTag).not.toContain('relative grid');
  });

  it('the marker icon stays decorative, so the trigger carries the only accessible name', () => {
    const out = html(earnings({ goldBalance: 42 }), GAP);
    const tagMatch = out.match(/<button[^>]*data-testid="live-earnings-gold-current-age-trigger"[^>]*>([\s\S]*?)<\/button>/);
    const inner = tagMatch?.[1] ?? '';
    expect(inner).not.toContain('aria-label');
    expect(inner).not.toContain('role="img"');
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
  it('lays the six blocks out three per row on explicit fixed-width tracks, with no per-block border box', () => {
    const out = html(earnings());
    // Fixed pixel/rem tracks, not `1fr` — a changing value or a language toggle can never resize
    // a column. All three tracks share one width so the six blocks stay identically sized too.
    expect(out).toContain('class="grid grid-cols-[repeat(3,7rem)] gap-x-3 gap-y-3"');
    expect(out).not.toContain('1fr');
    expect(out).not.toContain('rounded-lg border');
  });

  it("a block's label never wraps — it is sized to fit the fixed column in both languages, so it overflows rather than wrapping if it ever doesn't", () => {
    const out = html(earnings());
    const labelTag = out.match(/<span class="block w-full text-right text-\[10\.5px\] uppercase leading-none tracking-\[0\.06em\] text-muted whitespace-nowrap">/);
    expect(labelTag).not.toBeNull();
  });

  it('every one of the six blocks is independently addressable, for layout measurement outside this suite', () => {
    const out = html(earnings());
    for (const blockTestId of [
      'live-earnings-block-current-gold',
      'live-earnings-block-gold-rate',
      'live-earnings-block-gold-total',
      'live-earnings-block-elapsed',
      'live-earnings-block-xp-rate',
      'live-earnings-block-xp-total',
    ]) {
      expect(out).toContain(`data-testid="${blockTestId}"`);
    }
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

/** The `d` attribute of every stroked path the sparkline emitted, in document order. */
function sparklineLines(out: string): readonly string[] {
  return [...out.matchAll(/<path d="([^"]+)"[^>]*stroke="currentColor"/g)].map((match) => match[1] ?? '');
}

describe('EarningsPanel — the 10-minute trend', () => {
  it('draws the series it was given', () => {
    const out = html(earnings({ gold10Series: [100, 200, 300] }));
    expect(sparklineLines(out)).toHaveLength(1);
  });

  it('breaks the line where the stream did not cover a slice', () => {
    const out = html(earnings({ gold10Series: [100, null, 300] }));
    expect(sparklineLines(out)).toHaveLength(2);
  });

  it('prints the window peak, so the line height means a number', () => {
    const out = html(earnings({ gold10Series: [100_000, 1_400_000, 900_000] }));
    expect(cellText(out, 'live-earnings-trend-peak')).toContain('1.4m');
  });

  it('says nothing about a peak when no slice was ever streamed', () => {
    const out = html(earnings({ gold10Series: [null, null] }));
    expect(out).not.toContain('live-earnings-trend-peak');
    expect(sparklineLines(out)).toHaveLength(0);
  });

  it('still reserves the chart when there are no earnings at all', () => {
    const out = html(null);
    expect(out).toContain('data-testid="live-earnings-trend"');
    expect(out).toContain('data-sparkline');
  });
});

describe('EarningsPanel — the measured figures', () => {
  it('prints gold per prop, prop throughput and the session prop count', () => {
    const out = html(earnings({ goldPerProp10: 179.2, propsPerMinute10: 114, propsSessionTotal: 95 }));

    expect(cellText(out, 'live-earnings-gold-per-prop')).toContain('179.2');
    expect(cellText(out, 'live-earnings-props-per-minute')).toContain('114');
    expect(cellText(out, 'live-earnings-props-total')).toContain('95');
  });

  it('dashes a figure the fold has not measured yet rather than printing a zero', () => {
    const out = html(earnings({ goldPerProp10: null, propsPerMinute10: null, propsSessionTotal: null }));

    expect(cellText(out, 'live-earnings-gold-per-prop')).toBe('—');
    expect(cellText(out, 'live-earnings-props-per-minute')).toBe('—');
    expect(cellText(out, 'live-earnings-props-total')).toBe('—');
  });

  it('distinguishes a measured zero from an unmeasured figure', () => {
    const out = html(earnings({ propsPerMinute10: 0 }));
    expect(cellText(out, 'live-earnings-props-per-minute')).toBe('0');
  });

  it('marks the whole row as measured, against the map panel’s estimates', () => {
    const out = html(earnings());
    expect(cellText(out, 'live-earnings-measured-trigger')).toBe(en.liveEarningsMeasuredNote);
    // The popup itself only mounts once opened, so the full explanation reaches a screen reader
    // through the trigger's own label — the same way the XP help beside it does.
    expect(out).toContain(`aria-label="${en.liveEarningsMeasuredNote}: ${en.liveEarningsMeasuredBody}"`);
  });
});

describe('EarningsPanel — gold per prop against the map estimate', () => {
  it('reports a shortfall against the estimate, in the tone that says so', () => {
    const out = html(earnings({ goldPerProp10: 179.2 }), LIVE, -0.0224);
    expect(cellText(out, 'live-earnings-gold-per-prop-delta')).toBe('2% under estimate');
    expect(out).toContain('text-down');
  });

  it('reports an overshoot the other way', () => {
    const out = html(earnings({ goldPerProp10: 200 }), LIVE, 0.09);
    expect(cellText(out, 'live-earnings-gold-per-prop-delta')).toBe('9% over estimate');
    expect(out).toContain('text-up');
  });

  it('calls a deviation too small to round agreement, not a signed zero', () => {
    const out = html(earnings({ goldPerProp10: 183 }), LIVE, -0.004);
    expect(cellText(out, 'live-earnings-gold-per-prop-delta')).toBe(en.liveEarningsGoldPerPropOnEstimate);
  });

  it('says nothing when the map has no estimate to compare against', () => {
    const out = html(earnings({ goldPerProp10: 179.2 }), LIVE, null);
    expect(out).not.toContain('live-earnings-gold-per-prop-delta');
  });

  it('never annotates a figure that is not there', () => {
    const out = html(earnings({ goldPerProp10: null }), LIVE, -0.5);
    expect(cellText(out, 'live-earnings-gold-per-prop')).toBe('—');
    expect(out).not.toContain('live-earnings-gold-per-prop-delta');
  });
});
