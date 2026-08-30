import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { en } from '../../lib/copy/en';
import { StateSummaryBar } from './state-summary-bar';

// `useCopy()` is a hook, so it needs an active React dispatcher — fine for the
// `renderToStaticMarkup` calls below, but not for calling `StateSummaryBar` directly as a plain
// function the way the tooltip-content tests do. Mocking it the same way `earnings-panel.test.tsx`
// does covers both. `sub()` is unused here but kept for parity with that file's mock shape.
vi.mock('../../lib/copy', () => ({
  useCopy: () => en,
  sub: (template: string, values: Record<string, string | number>) =>
    template.replace(/\{(\w+)\}/g, (fallback: string, key: string) => String(values[key] ?? fallback)),
}));

const REQUIRED_PROPS = {
  onFieldCount: '3/5',
  recoveringCount: '2',
  recoveringFacts: [] as string[],
  queuedCount: '1',
  benchedCount: '4',
};

function html(overrides: Partial<Parameters<typeof StateSummaryBar>[0]> = {}) {
  return renderToStaticMarkup(createElement(StateSummaryBar, { ...REQUIRED_PROPS, ...overrides }));
}

/**
 * Walks the plain React-element tree `StateSummaryBar(...)` returns when called directly as a
 * function (no dispatcher, no actual render) to find the one element carrying `data-testid` — Base
 * UI mounts a tooltip's popup only once open, so this is how its content is reached without a real
 * browser. Unlike `earnings-panel.test.tsx`'s own helper of the same name, this one walks every
 * prop value (not just `children`): the tooltip content here reaches `Tooltip.Popup` through a
 * `tooltip` prop on the local `StatBadge` component, not through JSX children.
 */
function findElementByTestId(node: unknown, testId: string): { props: Record<string, unknown> } | null {
  if (node === null || node === undefined) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findElementByTestId(item, testId);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== 'object') return null;
  const element = node as { props?: Record<string, unknown> };
  if (!element.props) return null;
  if (element.props['data-testid'] === testId) return element as { props: Record<string, unknown> };
  for (const value of Object.values(element.props)) {
    if (value !== null && typeof value === 'object') {
      const found = findElementByTestId(value, testId);
      if (found) return found;
    }
  }
  return null;
}

/** Flattens an unrendered element (or its `children`) down to its text content. */
function textOf(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node !== null && typeof node === 'object') {
    return textOf((node as { props?: { children?: unknown } }).props?.children);
  }
  return '';
}

describe('StateSummaryBar — the four counts', () => {
  it('renders every count with its own colour, matching the row dots below it', () => {
    const out = html();
    expect(out).toMatch(/data-testid="live-state-summary-on-field-count" class="[^"]*\btext-up\b/);
    expect(out).toMatch(/data-testid="live-state-summary-recovering-count" class="[^"]*\btext-info\b/);
    expect(out).toMatch(/data-testid="live-state-summary-queued-count" class="[^"]*\btext-warn\b/);
    expect(out).toMatch(/data-testid="live-state-summary-benched-count" class="[^"]*\btext-muted\b/);
    expect(out).toMatch(/aria-hidden="true" class="[^"]*\bbg-up\b/);
    expect(out).toMatch(/aria-hidden="true" class="[^"]*\bbg-info\b/);
    expect(out).toMatch(/aria-hidden="true" class="[^"]*\bbg-warn\b/);
    expect(out).toMatch(/aria-hidden="true" class="[^"]*\bbg-muted\b/);
  });

  it('prints the field occupancy against the cap, and the plain idle/benched counts, verbatim', () => {
    const out = html({ onFieldCount: '3/5', queuedCount: '1', benchedCount: '4' });
    expect(out).toContain('>3/5<');
    expect(out).toContain('>1<');
    expect(out).toContain('>4<');
  });

  it('reuses the existing section-title copy keys for every state name', () => {
    const out = html();
    expect(out).toContain(en.liveListOnFieldTitle);
    expect(out).toContain(en.liveListRecoveringTitle);
    expect(out).toContain(en.liveListQueuedTitle);
    expect(out).toContain(en.liveListBenchedTitle);
  });
});

describe('StateSummaryBar — on-field slots hint moves into a tooltip', () => {
  it('renders a plain count with no button and no tooltip when there is no hint to show', () => {
    const out = html({ onFieldHint: undefined });
    const tagMatch = out.match(/<[a-z]+[^>]*data-testid="live-state-summary-on-field"[^>]*>/);
    expect(tagMatch?.[0]).not.toMatch(/^<button/);
  });

  it('renders a keyboard-reachable, dotted-underline trigger once there is a hint', () => {
    const out = html({ onFieldHint: en.liveFieldSlotsHint });
    const tagMatch = out.match(/<button[^>]*data-testid="live-state-summary-on-field"[^>]*>/);
    expect(tagMatch).not.toBeNull();
    const tag = tagMatch?.[0] ?? '';
    expect(tag).toMatch(/class="[^"]*\bunderline\b[^"]*\bdecoration-dotted\b[^"]*"/);
    expect(tag).not.toContain('tabindex="-1"');
    expect(tag).not.toContain('disabled=');
  });

  it('carries the hint text, reachable through the trigger', () => {
    const root = StateSummaryBar({ ...REQUIRED_PROPS, onFieldHint: en.liveFieldSlotsHint });
    const body = findElementByTestId(root, 'live-state-summary-on-field-hint');
    expect(body?.props.children).toBe(en.liveFieldSlotsHint);
  });

  it('names the state, the count, and the hint in the trigger aria-label, for a reader that never opens the popup', () => {
    const out = html({ onFieldCount: '3/5', onFieldHint: en.liveFieldSlotsHint });
    const tagMatch = out.match(/<button[^>]*data-testid="live-state-summary-on-field"[^>]*>/);
    expect(tagMatch?.[0]).toContain(`aria-label="${en.liveListOnFieldTitle} 3/5 — ${en.liveFieldSlotsHint}"`);
  });
});

describe('StateSummaryBar — resting slots hint and facts move into one tooltip', () => {
  it('renders a plain count with no tooltip when the house sent neither a hint nor a fact', () => {
    const out = html({ recoveringHint: undefined, recoveringFacts: [] });
    const tagMatch = out.match(/<[a-z]+[^>]*data-testid="live-state-summary-recovering"[^>]*>/);
    expect(tagMatch?.[0]).not.toMatch(/^<button/);
  });

  it('renders the trigger once there is a fact, even with no hint', () => {
    const out = html({ recoveringHint: undefined, recoveringFacts: ['Full rest cycle 17:30'] });
    expect(out).toMatch(/<button[^>]*data-testid="live-state-summary-recovering"[^>]*>/);
  });

  it('carries every fact and the hint, reachable through the trigger', () => {
    const root = StateSummaryBar({
      ...REQUIRED_PROPS,
      recoveringHint: en.liveRestingSlotsHint,
      recoveringFacts: ['Full rest cycle 17:30', '3 of 15 skips left today'],
    });
    const facts = findElementByTestId(root, 'live-state-summary-recovering-facts');
    const hint = findElementByTestId(root, 'live-state-summary-recovering-hint');
    expect(textOf(facts)).toContain('Full rest cycle 17:30');
    expect(textOf(facts)).toContain('3 of 15 skips left today');
    expect(hint?.props.children).toBe(en.liveRestingSlotsHint);
  });
});
