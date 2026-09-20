import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { en } from '../../lib/copy/en';
import type { AccountViewState } from '../../lib/account/use-account-view';
import type { OptimizerSnapshotHook } from '../../lib/optimizer/use-optimizer-snapshot';

// `useCopy()`/`useLocale()` are hooks over a context this test never mounts a provider for; the
// account seam and the optimizer's own window-lifetime singleton reach a preload bridge and
// browser storage that do not exist in a node-environment render. All three are replaced.
vi.mock('../../lib/copy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/copy')>();
  return { ...actual, useCopy: () => en, useLocale: () => ({ locale: 'en', lang: 'en', bcp47: 'en-US' }) };
});

const accountState = vi.hoisted(() => ({ current: null as unknown as AccountViewState }));
const optimizerState = vi.hoisted(() => ({ current: null as unknown as OptimizerSnapshotHook }));

vi.mock('../../lib/account/use-account-view', () => ({
  useAccountView: () => accountState.current,
}));

vi.mock('../../lib/optimizer/use-optimizer-snapshot', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/optimizer/use-optimizer-snapshot')>();
  return { ...actual, useOptimizerSnapshot: () => optimizerState.current };
});

// The settled-state tests below exist only to prove this connector's own banner logic — mounting
// the real package screen needs a full TeamPlanInputs, a runner and a plan store this file has no
// reason to fake.
vi.mock('./optimizer-screen', () => ({
  OptimizerScreen: () => createElement('div', { 'data-testid': 'optimizer-screen-stub' }),
}));

const { OptimizerView } = await import('./optimizer-view');

function render() {
  return renderToStaticMarkup(createElement(OptimizerView));
}

function idleOptimizerHook(): OptimizerSnapshotHook {
  return {
    state: { status: 'idle' },
    planState: { runStatus: 'idle', runId: null, plan: null, signature: null, heroes: null, basis: null, openHeroIds: null },
    stale: false,
    hasAccount: false,
    runner: {} as OptimizerSnapshotHook['runner'],
    open: () => {},
    refresh: () => {},
    startRun: () => {},
    resolveRun: () => {},
    applyPlan: () => {},
    clearPlan: () => {},
    openHeroes: () => {},
  };
}

describe('the four early states each render their own copy key', () => {
  it('bridge-unavailable', () => {
    accountState.current = { status: 'bridge-unavailable', applied: 0, key: null };
    optimizerState.current = idleOptimizerHook();
    const html = render();
    expect(html).toContain('data-testid="optimizer-view"');
    expect(html).toContain(en.emptyBridgeUnavailableTitle);
  });

  it('loading', () => {
    accountState.current = { status: 'loading', applied: 0, key: null };
    optimizerState.current = idleOptimizerHook();
    const html = render();
    expect(html).toContain(en.shellLoadingLabel);
  });

  it('error', () => {
    accountState.current = { status: 'error', message: 'boom', applied: 0, key: null };
    optimizerState.current = idleOptimizerHook();
    const html = render();
    expect(html).toContain(en.errorAccountReadFailed);
    expect(html).toContain('data-account-error-detail="boom"');
  });

  it('the mapper judged the account incomplete', () => {
    accountState.current = {
      status: 'loaded',
      key: 'k1',
      applied: 1,
      view: { payload: {}, gameRunning: false, store: { status: 'ok', reason: null, binding: 'better-sqlite3' } } as never,
    };
    optimizerState.current = {
      ...idleOptimizerHook(),
      hasAccount: true,
      state: { status: 'unavailable', reason: 'incomplete-account', sourceKey: 'k1', farmChosenPhase: null },
    };
    const html = render();
    expect(html).toContain(en.farmUnavailableTitle);
    expect(html).toContain(en.optimizerUnavailableDescription);
  });

  it('nothing settled yet (the very first compute)', () => {
    accountState.current = {
      status: 'loaded',
      key: 'k1',
      applied: 1,
      view: { payload: {}, gameRunning: false, store: { status: 'ok', reason: null, binding: 'better-sqlite3' } } as never,
    };
    optimizerState.current = {
      ...idleOptimizerHook(),
      hasAccount: true,
      state: { status: 'computing', sourceKey: 'k1', farmChosenPhase: null, previous: null },
    };
    const html = render();
    expect(html).toContain(en.shellLoadingLabel);
  });
});

function readyOptimizerHook(leftOut: { id: string; name: string }[]): OptimizerSnapshotHook {
  return {
    ...idleOptimizerHook(),
    hasAccount: true,
    state: {
      status: 'ready',
      sourceKey: 'k1',
      farmChosenPhase: null,
      inputs: {} as never,
      capturedAt: null,
      leftOut,
    },
  };
}

function loadedAccountState(): AccountViewState {
  return {
    status: 'loaded',
    key: 'k1',
    applied: 1,
    view: { payload: {}, gameRunning: false, store: { status: 'ok', reason: null, binding: 'better-sqlite3' } } as never,
  };
}

describe('the left-out-heroes banner', () => {
  it('names every left-out hero when the settled snapshot carries them', () => {
    accountState.current = loadedAccountState();
    optimizerState.current = readyOptimizerHook([
      { id: 'h1', name: 'Rowan' },
      { id: 'h2', name: 'Perrin' },
    ]);
    const html = render();
    expect(html).toContain('data-testid="optimizer-left-out"');
    expect(html).toContain(en.optimizerLeftOutTitle);
    expect(html).toContain('Rowan, Perrin');
  });

  it('is absent when nothing was left out', () => {
    accountState.current = loadedAccountState();
    optimizerState.current = readyOptimizerHook([]);
    const html = render();
    expect(html).not.toContain('data-testid="optimizer-left-out"');
  });
});

describe('the connector draws nothing the package draws', () => {
  const viewSource = readFileSync(path.join(__dirname, 'optimizer-view.tsx'), 'utf8');
  const screenSource = readFileSync(path.join(__dirname, 'optimizer-screen.tsx'), 'utf8');
  const combined = viewSource + screenSource;

  it('imports the package\'s screen components exactly once', () => {
    const imports = combined.match(/from ['"]@bombfarm\/team-plan\/components['"]/g) ?? [];
    expect(imports).toHaveLength(1);
  });

  it('never calls runner.run and never passes createWorker to the screen', () => {
    expect(combined).not.toMatch(/runner\.run\(/);
    expect(combined).not.toMatch(/createWorker=/);
  });

  it('has one control handler — applyTeamPlanControlChange called exactly once', () => {
    const calls = combined.match(/applyTeamPlanControlChange\(/g) ?? [];
    expect(calls).toHaveLength(1);
  });

  it('never gates the stale notice itself — that is the package\'s own job', () => {
    expect(combined).not.toMatch(/\{stale \?/);
  });

  it('calls the one recompute path exactly once', () => {
    const calls = viewSource.match(/\brefresh\(\)/g) ?? [];
    expect(calls).toHaveLength(1);
  });

  it('asks the app to go and read the account, not only to re-solve from the one in hand', () => {
    expect(viewSource).toContain('useAccountReadRequest(adoptLive)');
  });
});
