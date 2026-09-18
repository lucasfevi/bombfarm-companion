import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AccountReadRefusal } from '@bombfarm/contracts';
import { STRINGS, sub } from '../lib/copy';
import { accountReadRefusalText } from '../lib/account-read-labels';
import { AccountRefreshControl, accountRefreshAgeLine } from './account-refresh-control';

const en = STRINGS.en;

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function render(props: Partial<Parameters<typeof AccountRefreshControl>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(AccountRefreshControl, {
      capturedAt: minutesAgo(0),
      stale: false,
      busy: false,
      readState: { kind: 'idle' },
      onRefresh: () => {},
      ...props,
    }),
  );
}

function tagOf(html: string, testid: string): string {
  return new RegExp(`<[a-z]+[^>]*data-testid="${testid}"[^>]*>`).exec(html)?.[0] ?? '';
}

function textOf(html: string, testid: string): string {
  return new RegExp(`<[a-z]+[^>]*data-testid="${testid}"[^>]*>([^<]*)<`).exec(html)?.[1] ?? '';
}

const BUTTON_STATE_ATTRIBUTES = / (disabled=""|data-disabled=""|aria-busy="[a-z]+")/g;

describe('AccountRefreshControl — one control, always present, two states', () => {
  it('offers the refresh whether or not the snapshot has gone out of date', () => {
    expect(render({ stale: false })).toContain('data-testid="account-refresh"');
    expect(render({ stale: true })).toContain('data-testid="account-refresh"');
  });

  it('states the age of the account the screen was computed from, while the live account still agrees with it', () => {
    expect(render({ capturedAt: minutesAgo(5) })).toContain(sub(en.farmRefreshedAge, { age: en.ageMinutes.replace('{n}', '5') }));
  });

  it('reads as freshly read for the first minute rather than as a zero', () => {
    expect(render({ capturedAt: minutesAgo(0) })).toContain(sub(en.farmRefreshedAge, { age: en.ageJustNow }));
  });

  it('says the numbers are out of date instead of their age once the live account has moved past them', () => {
    const html = render({ stale: true, capturedAt: minutesAgo(5) });
    expect(html).toContain(en.farmRefreshStale);
    expect(html).not.toContain(en.farmRefreshedAge.replace('{age}', ''));
  });

  it('claims no age at all for an account that carries no readable capture time', () => {
    const html = render({ capturedAt: null });
    expect(html).toContain('data-testid="account-refresh-age"');
    expect(html).not.toContain(en.farmRefreshedAge.replace('{age}', ''));
    expect(html).not.toContain(en.ageJustNow);
  });

  it('spins its icon and refuses a second press while a recompute is in flight', () => {
    const html = render({ busy: true });
    const button = tagOf(html, 'account-refresh');
    expect(button).toContain('disabled=""');
    expect(button).toContain('aria-busy="true"');
    expect(html).toContain('motion-safe:animate-spin');
  });

  it('is equally working while the account read is in flight, with the screen already re-solved', () => {
    const html = render({ busy: false, readState: { kind: 'working' } });
    const button = tagOf(html, 'account-refresh');
    expect(button).toContain('disabled=""');
    expect(button).toContain('aria-busy="true"');
    expect(html).toContain('motion-safe:animate-spin');
  });

  it('is pressable again, and still, once the recompute has settled', () => {
    const html = render({ busy: false });
    const button = tagOf(html, 'account-refresh');
    expect(button).not.toContain('disabled=""');
    expect(button).toContain('aria-busy="false"');
    expect(html).not.toContain('animate-spin');
  });
});

describe('the control is an icon with its line beside it, not a labelled button with a line beneath', () => {
  it('is named by copy and carries the refresh glyph, never a text label', () => {
    const html = render();
    expect(tagOf(html, 'account-refresh')).toContain(`aria-label="${en.farmRefresh}"`);
    expect(html).toContain('data-icon="arrow-path"');
    expect(textOf(html, 'account-refresh')).toBe('');
  });

  it('is the quiet square icon button, not the primary fill', () => {
    const button = tagOf(render(), 'account-refresh');
    expect(button).toContain('size-5');
    expect(button).not.toContain('bg-accent');
  });

  it('answers a hover or a focus with the design-system tooltip, never the native attribute', () => {
    const button = tagOf(render(), 'account-refresh');
    expect(button).toContain('data-slot="tooltip-trigger"');
    expect(button).not.toContain('title=');
  });

  it('sets the line to the left of the button, on one row, in the small tabular muted face', () => {
    const html = render({ capturedAt: minutesAgo(5) });
    expect(html.indexOf('data-testid="account-refresh-age"')).toBeLessThan(html.indexOf('data-testid="account-refresh"'));
    expect(tagOf(html, 'account-refresh-control')).toContain('items-center');
    expect(tagOf(html, 'account-refresh-control')).not.toContain('flex-col');
    const line = tagOf(html, 'account-refresh-age');
    expect(line).toContain('text-[11px]');
    expect(line).toContain('tabular-nums');
    expect(line).toContain('text-muted');
    expect(line).toContain('whitespace-nowrap');
  });

  it('turns the line to the warn tone once the numbers are out of date', () => {
    const line = tagOf(render({ stale: true }), 'account-refresh-age');
    expect(line).toContain('text-warn');
    expect(line).not.toContain('text-muted');
  });

  it('keeps the button the same element in every state, so nothing about it moves', () => {
    const idle = tagOf(render(), 'account-refresh').replace(BUTTON_STATE_ATTRIBUTES, '');
    const working = tagOf(render({ busy: true }), 'account-refresh').replace(BUTTON_STATE_ATTRIBUTES, '');
    const refused = tagOf(render({ readState: { kind: 'refused', reason: 'offline' } }), 'account-refresh').replace(
      BUTTON_STATE_ATTRIBUTES,
      '',
    );
    expect(working).toBe(idle);
    expect(refused).toBe(idle);
  });
});

/**
 * The press asks the app to go and read the account, so it can be answered by a read that never
 * started — and a screen that re-solved over the same account it already had, with nothing said,
 * is the stale answer this control exists to make impossible to misread.
 */
describe('a press that started no read says why, in the place of the age line', () => {
  it('says nothing about a read that is not being refused', () => {
    expect(render()).not.toContain('data-testid="account-refresh-refusal"');
    expect(render({ readState: { kind: 'working' } })).not.toContain('data-testid="account-refresh-refusal"');
  });

  it.each<AccountReadRefusal>([
    'rate_limited',
    'offline',
    'not_consented',
    'game_not_running',
    'token_unavailable',
    'unavailable',
  ])('has words for %s, in the same wording every other screen uses', (reason) => {
    const html = render({ readState: { kind: 'refused', reason } });
    expect(html).toContain(accountReadRefusalText(reason, en));
    expect(html).toContain('data-testid="account-refresh-refusal"');
  });

  it('leaves the button pressable — a refusal is not a read in flight', () => {
    const html = render({ readState: { kind: 'refused', reason: 'rate_limited' } });
    expect(tagOf(html, 'account-refresh')).not.toContain('disabled=""');
  });

  it('stands where the age line stood, in the warn tone, rather than as a second sentence', () => {
    const html = render({ capturedAt: minutesAgo(5), readState: { kind: 'refused', reason: 'offline' } });
    expect(html).not.toContain('data-testid="account-refresh-age"');
    expect(textOf(html, 'account-refresh-refusal')).toBe(en.accountReadFixture);
    expect(tagOf(html, 'account-refresh-refusal')).toContain('text-warn');
    expect(html.indexOf('data-testid="account-refresh-refusal"')).toBeLessThan(html.indexOf('data-testid="account-refresh"'));
  });

  it("shares the age line's face, so the swap changes the words and nothing else", () => {
    const age = tagOf(render({ capturedAt: minutesAgo(5) }), 'account-refresh-age');
    const refusal = tagOf(render({ capturedAt: minutesAgo(5), readState: { kind: 'refused', reason: 'offline' } }), 'account-refresh-refusal');
    expect(refusal.replace('account-refresh-refusal', 'account-refresh-age').replace('text-warn', 'text-muted')).toBe(age);
  });
});

describe("the line beside the button can be the caller's own", () => {
  it("prints the caller's own line where the thing refreshed is not the account read", () => {
    const html = render({ capturedAt: minutesAgo(5), ageLine: (age) => sub(en.pvpStandingAge, { age }) });
    expect(textOf(html, 'account-refresh-age')).toBe(sub(en.pvpStandingAge, { age: en.ageMinutes.replace('{n}', '5') }));
    expect(html).not.toContain(en.farmRefreshedAge.replace('{age}', ''));
  });
});

/**
 * The regression this control was rewritten for. A screen recomputes from whatever account the
 * renderer holds, and when the app has lost its ability to re-read the game that account stops
 * moving — so pressing Refresh produced a brand-new calculation over hours-old numbers. Dating the
 * line by the calculation made every such press read "just now"; dating it by the account read
 * cannot, whatever the compute did.
 */
describe('the age line dates the account read, never the calculation', () => {
  const t = STRINGS.en;

  it('an account read three hours ago still reads as three hours old, however recently the screen was computed', () => {
    const now = Date.now();
    const line = accountRefreshAgeLine(new Date(now - 3 * 3_600_000).toISOString(), false, t, now);
    expect(line).toBe(sub(t.farmRefreshedAge, { age: t.ageHours.replace('{n}', '3') }));
    expect(line).not.toContain(t.ageJustNow);
  });

  it('two computes a minute apart over the SAME account read report the same age, not two fresh ones', () => {
    const capturedAt = new Date(Date.now() - 40 * 60_000).toISOString();
    const firstComputeAt = Date.now();
    const secondComputeAt = firstComputeAt + 60_000;
    expect(accountRefreshAgeLine(capturedAt, false, t, firstComputeAt)).toBe(
      sub(t.farmRefreshedAge, { age: t.ageMinutes.replace('{n}', '40') }),
    );
    expect(accountRefreshAgeLine(capturedAt, false, t, secondComputeAt)).toBe(
      sub(t.farmRefreshedAge, { age: t.ageMinutes.replace('{n}', '41') }),
    );
  });
});

/**
 * The control is drawn ONCE, by the shell's refresh bar, and never by a screen. A screen whose
 * numbers come from a copy of its own — the board, the bag, the snapshot, the standing — hands the
 * bar its refresh through the registry instead, so the button is in one place on every tab and
 * still does what that screen needs.
 */
function stripped(...segments: string[]): string {
  return segments
    .map((segment) => readFileSync(path.join(__dirname, segment), 'utf8'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe('the shell draws the control once, in its band under the top bar', () => {
  const page = stripped('page.tsx');
  const bar = stripped('refresh-state-bar.tsx');

  it('the scan reads real files', () => {
    expect(page).toMatch(/export default function HomePage/);
    expect(bar).toMatch(/export function RefreshStateBar/);
  });

  it('the bar is the one place the control is mounted', () => {
    expect(bar).toContain('<AccountRefreshControl');
    for (const screen of ['farm/farm-view.tsx', 'forge/forge-view.tsx', 'optimizer/optimizer-view.tsx', 'optimizer/optimizer-screen.tsx', 'pvp/pvp-view.tsx', 'pvp/standing-panel.tsx']) {
      expect(stripped(screen), screen).not.toContain('AccountRefreshControl');
    }
  });

  it('the shell mounts the bar in its banner slot, on every tab but Settings', () => {
    expect(page).toContain('<RefreshStateBar tabId={activeNavId}');
    expect(page).toContain("activeNavId !== 'settings'");
  });

  it("a screen that registers nothing gets the live account read's age and a read of it", () => {
    expect(bar).toContain('useAccountReadRequest(');
    expect(bar).toContain('oldestCaptureOf(live.payload)');
  });
});

describe('the Farm screen hands the bar its refresh, with no staleness gate around it', () => {
  const source = stripped('farm/farm-view.tsx');

  it('the scan reads a real file', () => {
    expect(source).toMatch(/export function FarmView/);
  });

  it("registers under its own tab id, dating the line by the settled board's account read", () => {
    expect(source).toContain("useScreenRefreshRegistration('farm', { capturedAt: settled?.capturedAt ?? null, stale, busy, readState, onRefresh })");
    expect(source).not.toMatch(/\{stale \?/);
  });

  it("refreshes through the screen's one recompute path, never a second call into the store", () => {
    const refreshCalls = source.match(/\brefresh\(/g) ?? [];
    expect(refreshCalls).toHaveLength(1);
  });

  it('asks the app to go and read the account, not only to re-solve from the one in hand', () => {
    expect(source).toContain('useAccountReadRequest(adoptLive)');
  });
});

describe('the Forge screen hands the bar its refresh, not a refresh of its own', () => {
  const source = stripped('forge/forge-view.tsx');

  it('the scan reads a real file', () => {
    expect(source).toMatch(/export function ForgeView/);
  });

  it("registers under its own tab id, dating the line by the pinned bag's account read", () => {
    expect(source).toContain("useScreenRefreshRegistration('forge', { capturedAt, stale, busy: false, readState: refreshState, onRefresh: refresh })");
    expect(source).not.toContain('ForgeRefresh');
  });

  it('asks the app to go and read the account, not only to re-pin the one in hand', () => {
    expect(source).toContain('useAccountReadRequest(adoptLive)');
  });
});

describe('the Optimizer screen hands the bar its refresh, with no staleness gate around it', () => {
  const source = stripped('optimizer/optimizer-view.tsx', 'optimizer/optimizer-screen.tsx');

  it('the scan reads real files', () => {
    expect(source).toMatch(/export function OptimizerView/);
    expect(source).toMatch(/export function OptimizerScreen/);
  });

  it("registers under its own tab id, dating the line by the settled snapshot's account read", () => {
    expect(source).toContain("useScreenRefreshRegistration('optimizer', { capturedAt: settled?.capturedAt ?? null, stale, busy, readState, onRefresh })");
    expect(source).not.toMatch(/\{stale \?/);
  });

  it("refreshes through the screen's one recompute path, never a second call into the store", () => {
    const refreshCalls = source.match(/\brefresh\(\)/g) ?? [];
    expect(refreshCalls).toHaveLength(1);
  });

  it('asks the app to go and read the account, not only to re-solve from the one in hand', () => {
    expect(source).toContain('useAccountReadRequest(adoptLive)');
  });
});

describe("the PVP screen hands the bar the standing's own read, dated by the standing", () => {
  const source = stripped('pvp/pvp-view.tsx');

  it('the scan reads a real file', () => {
    expect(source).toMatch(/export function PvpView/);
  });

  it("registers the standing read under its own tab id, with the standing's line", () => {
    expect(source).toContain("useScreenRefreshRegistration('pvp', {");
    expect(source).toContain('capturedAt: history?.standing?.capturedAt ?? null');
    expect(source).toContain('onRefresh: refresh.request');
    expect(source).toContain('ageLine: standingAge');
    expect(source).toContain('sub(t.pvpStandingAge, { age })');
  });

  it('asks main for the standing, never the account', () => {
    expect(source).toContain('usePvpRefresh()');
    expect(source).not.toContain('useAccountReadRequest');
  });
});
