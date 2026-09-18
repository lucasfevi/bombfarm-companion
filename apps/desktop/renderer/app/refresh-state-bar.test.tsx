import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AccountView } from '@bombfarm/contracts';
import { en } from '../lib/copy/en';
import { sub } from '../lib/copy';
import type { AccountViewState } from '../lib/account/use-account-view';
import type { AccountReadRequest } from '../lib/account/use-account-read-request';
import type { ScreenRefreshState } from '../lib/refresh/screen-refresh-store';

// `useCopy()` is a hook over a context this test never mounts a provider for; the account seam
// and the read request reach a preload bridge that does not exist in a node-environment render;
// and `useSyncExternalStore` hands a static render its server snapshot, which is always "nothing
// registered". All four are replaced so each branch of the bar can be rendered on purpose.
vi.mock('../lib/copy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/copy')>();
  return { ...actual, useCopy: () => en };
});

const accountState = vi.hoisted((): { current: AccountViewState } => ({ current: { status: 'loading', applied: 0, key: null } }));
const liveRead = vi.hoisted((): { current: AccountReadRequest } => ({ current: { state: { kind: 'idle' }, request: () => {} } }));
const registered = vi.hoisted(() => ({ current: null as ScreenRefreshState | null }));

vi.mock('../lib/account/use-account-view', () => ({ useAccountView: () => accountState.current }));
vi.mock('../lib/account/use-account-read-request', () => ({ useAccountReadRequest: () => liveRead.current }));
vi.mock('../lib/refresh/screen-refresh-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/refresh/screen-refresh-store')>();
  return { ...actual, useScreenRefresh: () => registered.current };
});

const { RefreshStateBar } = await import('./refresh-state-bar');

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function loadedAccount(capturedAt: string): AccountViewState {
  const fidelity = { status: 'resolved', capturedAt } as const;
  const view = {
    payload: {
      fidelity: { account: fidelity, heroes: fidelity, skills: fidelity, casa: fidelity, items: fidelity },
    },
  } as unknown as AccountView;
  return { status: 'loaded', view, applied: 1, key: 'k' };
}

function render(tabId: string, label = 'Heroes'): string {
  return renderToStaticMarkup(createElement(RefreshStateBar, { tabId, label }));
}

function tagOf(html: string, testId: string): string {
  return new RegExp(`<[a-z]+[^>]*data-testid="${testId}"[^>]*>`).exec(html)?.[0] ?? '';
}

function textOf(html: string, testId: string): string {
  return new RegExp(`<[a-z]+[^>]*data-testid="${testId}"[^>]*>([^<]*)<`).exec(html)?.[1] ?? '';
}

describe('RefreshStateBar — the tab name at one end, the one refresh control at the other', () => {
  it('names the tab it is drawn under and carries the shared control by its own testids', () => {
    registered.current = null;
    const html = render('heroes', 'Heroes');
    expect(textOf(html, 'refresh-state-subject')).toBe('Heroes');
    expect(html).toContain('data-testid="account-refresh-control"');
    expect(html).toContain('data-testid="account-refresh"');
    expect(html.indexOf('refresh-state-subject')).toBeLessThan(html.indexOf('account-refresh-control'));
  });

  it("a screen that registered nothing is dated by the live account read's oldest section", () => {
    registered.current = null;
    accountState.current = loadedAccount(minutesAgo(7));
    const html = render('heroes');
    expect(html).toContain('data-source="live-account"');
    expect(textOf(html, 'account-refresh-age')).toBe(sub(en.farmRefreshedAge, { age: en.ageMinutes.replace('{n}', '7') }));
  });

  it('with no account loaded yet the line is empty rather than borrowing the clock', () => {
    registered.current = null;
    accountState.current = { status: 'loading', applied: 0, key: null };
    expect(textOf(render('heroes'), 'account-refresh-age')).toBe('');
  });

  it("the fallback's refusal is the live read's, so a refused press on any plain tab says why", () => {
    registered.current = null;
    liveRead.current = { state: { kind: 'refused', reason: 'game_not_running' }, request: () => {} };
    const html = render('inventory');
    expect(textOf(html, 'account-refresh-refusal')).toBe(en.accountReadGameNotRunning);
    liveRead.current = { state: { kind: 'idle' }, request: () => {} };
  });

  it("a registered screen's state wins over the live account: its age, its staleness, its line", () => {
    accountState.current = loadedAccount(minutesAgo(1));
    registered.current = {
      capturedAt: minutesAgo(30),
      stale: true,
      busy: false,
      readState: { kind: 'idle' },
      onRefresh: () => {},
    };
    const html = render('farm', 'Farm');
    expect(html).toContain('data-source="screen"');
    expect(textOf(html, 'account-refresh-age')).toBe(en.farmRefreshStale);
  });

  it("a registered screen's own age line is printed in place of the account read's", () => {
    registered.current = {
      capturedAt: minutesAgo(5),
      stale: false,
      busy: false,
      readState: { kind: 'idle' },
      onRefresh: () => {},
      ageLine: (age) => sub(en.pvpStandingAge, { age }),
    };
    const html = render('pvp', 'PVP');
    expect(textOf(html, 'account-refresh-age')).toBe(sub(en.pvpStandingAge, { age: en.ageMinutes.replace('{n}', '5') }));
    expect(html).not.toContain(en.farmRefreshedAge.replace('{age}', ''));
  });

  it('a registered screen that is computing shows the control working', () => {
    registered.current = { capturedAt: minutesAgo(2), stale: false, busy: true, readState: { kind: 'idle' }, onRefresh: () => {} };
    const html = render('optimizer', 'Optimizer');
    const button = tagOf(html, 'account-refresh');
    expect(button).toContain('disabled=""');
    expect(button).toContain('aria-busy="true"');
  });
});
