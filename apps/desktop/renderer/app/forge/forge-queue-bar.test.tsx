import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { en } from '../../lib/copy/en';
import type { AccountViewState } from '../../lib/account/account-view-store';
import type { ForgeQueueState } from '../../lib/forge/forge-queue-reducer';
import type { DeconstructRunState } from '../../lib/deconstruct/deconstruct-run-reducer';
import type { ForgeRunState } from '../../lib/forge/forge-run-reducer';

// The band reads three window-lifetime stores and the copy context; none of them exist in a
// node-environment render (`optimizer-view.test.tsx`'s own reasoning), so every hook is replaced
// with a fixture this file controls.
vi.mock('../../lib/copy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/copy')>();
  return { ...actual, useCopy: () => en, useLocale: () => ({ locale: 'en', lang: 'en', bcp47: 'en-US' }) };
});

const queueState = vi.hoisted(() => ({ current: null as unknown as ForgeQueueState }));
const runState = vi.hoisted<{ current: ForgeRunState }>(() => ({ current: { status: 'idle' } }));
const burnState = vi.hoisted<{ current: DeconstructRunState }>(() => ({ current: { status: 'idle' } }));
const accountState = vi.hoisted(() => ({ current: null as unknown as AccountViewState }));

vi.mock('../../lib/forge/forge-queue-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/forge/forge-queue-store')>();
  return { ...actual, useForgeQueue: () => queueState.current, syncForgeQueue: () => {} };
});

vi.mock('../../lib/forge/forge-run-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/forge/forge-run-store')>();
  return { ...actual, useForgeRun: () => runState.current };
});

vi.mock('../../lib/deconstruct/deconstruct-run-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/deconstruct/deconstruct-run-store')>();
  return { ...actual, useDeconstructRun: () => burnState.current };
});

vi.mock('../../lib/account/use-account-view', () => ({
  useAccountView: () => accountState.current,
}));

const { ForgeQueueBar } = await import('./forge-queue-bar');

const LOADED_ACCOUNT = {
  status: 'loaded',
  applied: 1,
  key: 'k',
  view: { payload: { items: [], heroes: [], account: {} } },
} as unknown as AccountViewState;

function baseQueue(status: ForgeQueueState['status']): ForgeQueueState {
  return {
    pieces: [{ itemId: 'sword-1', target: 10 }],
    status,
    active: status === 'paused' ? { itemId: 'sword-1', runId: 'r1' } : null,
    halt: null,
    forged: 0,
  };
}

function render(status: ForgeQueueState['status']): string {
  queueState.current = baseQueue(status);
  accountState.current = LOADED_ACCOUNT;
  return renderToStaticMarkup(
    createElement(ForgeQueueBar, { forgeWritesEnabled: true, accountSource: null, onOpenForge: () => {} }),
  );
}

describe('ForgeQueueBar — paused for the Optimizer', () => {
  it('reads data-status="paused" and the paused line, with no Start and a Cancel, while paused', () => {
    const html = render('paused');
    expect(html).toContain('data-status="paused"');
    expect(html).toContain('data-testid="forge-queue-paused"');
    expect(html).toContain(en.forgeQueuePausedForApply);
    expect(html).not.toContain('data-testid="forge-queue-start"');
    expect(html).toContain('data-testid="forge-queue-cancel"');
  });

  it('draws no paused line while running', () => {
    const html = render('running');
    expect(html).not.toContain('data-testid="forge-queue-paused"');
    expect(html).not.toContain(en.forgeQueuePausedForApply);
  });

  it('offers Start while idle, with no paused line', () => {
    queueState.current = { pieces: [{ itemId: 'sword-1', target: 10 }], status: 'idle', active: null, halt: null, forged: 0 };
    accountState.current = LOADED_ACCOUNT;
    const html = renderToStaticMarkup(
      createElement(ForgeQueueBar, { forgeWritesEnabled: true, accountSource: null, onOpenForge: () => {} }),
    );
    expect(html).toContain('data-testid="forge-queue-start"');
    expect(html).not.toContain('data-testid="forge-queue-paused"');
  });
});

describe('ForgeQueueBar — paused while items are burned', () => {
  const BURNING: DeconstructRunState = { status: 'running', runId: 'b1', itemIds: ['1'] };

  afterEach(() => {
    burnState.current = { status: 'idle' };
  });

  it('says the queue is paused for the burn, not for the Optimizer, while a burn is in flight', () => {
    burnState.current = BURNING;
    const html = render('paused');
    expect(html).toContain(en.forgeQueuePausedForBurn);
    expect(html).not.toContain(en.forgeQueuePausedForApply);
  });

  it('says the queue is paused for the burn from the moment the burn is asked for', () => {
    burnState.current = { status: 'starting' };
    expect(render('paused')).toContain(en.forgeQueuePausedForBurn);
  });

  it('still names the Optimizer when no burn is in flight', () => {
    const html = render('paused');
    expect(html).toContain(en.forgeQueuePausedForApply);
    expect(html).not.toContain(en.forgeQueuePausedForBurn);
  });

  it('disables Start for a halted queue while a burn is in flight, and says why', () => {
    burnState.current = BURNING;
    queueState.current = { pieces: [{ itemId: 'sword-1', target: 10 }], status: 'halted', active: null, halt: null, forged: 0 };
    accountState.current = LOADED_ACCOUNT;
    const html = renderToStaticMarkup(
      createElement(ForgeQueueBar, { forgeWritesEnabled: true, accountSource: 'server', onOpenForge: () => {} }),
    );
    expect(html).toMatch(/<button[^>]*data-testid="forge-queue-start"[^>]* disabled=""|<button[^>]* disabled=""[^>]*data-testid="forge-queue-start"/);
    expect(html).toContain(en.deconstructReasonRunning);
  });

  it('leaves Start enabled for the same halted queue once nothing is burning', () => {
    queueState.current = { pieces: [{ itemId: 'sword-1', target: 10 }], status: 'halted', active: null, halt: null, forged: 0 };
    accountState.current = LOADED_ACCOUNT;
    const html = renderToStaticMarkup(
      createElement(ForgeQueueBar, { forgeWritesEnabled: true, accountSource: 'server', onOpenForge: () => {} }),
    );
    expect(html).not.toMatch(/<button[^>]*data-testid="forge-queue-start"[^>]* disabled=""|<button[^>]* disabled=""[^>]*data-testid="forge-queue-start"/);
    expect(html).not.toContain(en.deconstructReasonRunning);
  });
});
