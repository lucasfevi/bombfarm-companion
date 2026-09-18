import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AccountPayload, AccountView as AccountViewData } from '@bombfarm/contracts';
import type { SkillTreeScreenProps } from '@bombfarm/account/skill-tree';
import { en } from '../../lib/copy/en';
import type { AccountViewState } from '../../lib/account/use-account-view';
import type { FarmPhaseSelection } from '../heroes/hero-phase';

const OFFLINE_FIXTURE = path.join(__dirname, '..', '..', '..', 'tests', 'fixtures', 'account-offline.json');

// `useCopy()`/`useLocale()` are hooks over a context this test never mounts a provider for, and
// the account seam reaches a preload bridge that does not exist in a node-environment render.
vi.mock('../../lib/copy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/copy')>();
  return { ...actual, useCopy: () => en, useLocale: () => ({ locale: 'en', lang: 'en', bcp47: 'en-US' }) };
});

const accountState = vi.hoisted(() => ({ current: null as unknown as AccountViewState }));
const farmPhase = vi.hoisted((): { current: FarmPhaseSelection } => ({ current: { ready: true, phase: 51 } }));
const screenProps = vi.hoisted(() => ({ last: null as SkillTreeScreenProps | null }));

vi.mock('../../lib/account/use-account-view', () => ({
  useAccountView: () => accountState.current,
}));

// A static render runs no effects, so the two stored-preference hooks would answer "not read yet"
// and the screen would price nothing; they are answered here the way the effects would after mount.
vi.mock('../heroes/use-farm-selected-phase', () => ({
  useFarmSelectedPhase: () => farmPhase.current,
}));

vi.mock('./use-stored-farm-controls', async () => {
  const { DEFAULT_FARM_CONTROLS } = await import('../../lib/farm/farm-inputs');
  return { useStoredFarmControls: () => DEFAULT_FARM_CONTROLS };
});

vi.mock('../../lib/pvp/use-pvp-history', () => ({
  usePvpHistory: () => ({ status: 'unavailable', applied: 0, history: null }),
  refreshPvpStanding: () => undefined,
}));

// The drawing is the shared package's and has its own tests; what this file proves is what the
// connector hands it.
vi.mock('@bombfarm/account/skill-tree', () => ({
  SkillTreeScreen: (props: SkillTreeScreenProps) => {
    screenProps.last = props;
    return createElement('div', { 'data-testid': 'skill-tree-screen' });
  },
}));

const { SkillsView } = await import('./skills-view');

function offlinePayload(): AccountPayload {
  return JSON.parse(readFileSync(OFFLINE_FIXTURE, 'utf8')) as AccountPayload;
}

function loaded(payload: AccountPayload): AccountViewState {
  const view: AccountViewData = {
    payload,
    gameRunning: false,
    store: { status: 'ok', reason: null, binding: 'better-sqlite3' },
  };
  return { status: 'loaded', view, applied: 1, key: 'k' };
}

function html(): string {
  return renderToStaticMarkup(createElement(SkillsView));
}

beforeEach(() => {
  screenProps.last = null;
  farmPhase.current = { ready: true, phase: 51 };
  accountState.current = loaded(offlinePayload());
});

describe('the Skill Tree screen', () => {
  it('draws the shared screen with the parsed tree and a priced roster for the offline account', () => {
    const markup = html();
    expect(markup).toContain('data-testid="skills-view"');
    expect(markup).toContain('data-pricing="priced"');
    expect(markup).toContain('data-testid="skill-tree-screen"');

    const props = screenProps.last;
    expect(props).not.toBeNull();
    expect(Object.keys(props?.state.levels ?? {}).length).toBeGreaterThan(0);
    expect(props?.totals.vagas_campo).toBe(8);
    expect(props?.pricing?.phase).toBe(51);
    expect(props?.pricing?.gains.length).toBeGreaterThan(0);
    expect(props?.objective).toBe('goldPerHour');
    expect(props?.labels.hubName).toBe(en.skillsHubName);
  });

  it('resolves each node\'s medallion through the bundled wiki art', () => {
    html();
    const hub = screenProps.last?.nodeArtSrc({
      id: 'H00',
      name: 'Reator',
      arm: 'hub',
      tier: 'start',
      ring: 0,
      maxLevel: 1,
      effects: [{ kind: 'team_dmg', perLevel: 0.05 }],
      costs: [0],
      refunds: [0],
      gatePhase: 0,
      requires: [],
    });
    expect(hub).toMatch(/\/skills\/.+\.png$/);
  });

  it('still draws the tree, unpriced, while the Farm phase has not been read', () => {
    farmPhase.current = { ready: false, phase: null };
    const markup = html();
    expect(markup).toContain('data-pricing="none"');
    expect(screenProps.last?.pricing).toBeNull();
    expect(Object.keys(screenProps.last?.state.levels ?? {}).length).toBeGreaterThan(0);
  });

  it('still draws the tree, unpriced, when the board itself could not be priced', () => {
    const payload = offlinePayload();
    accountState.current = loaded({
      ...payload,
      fidelity: { ...payload.fidelity, items: { status: 'missing' } } as AccountPayload['fidelity'],
    });
    const markup = html();
    expect(markup).toContain('data-pricing="none"');
    expect(screenProps.last?.pricing).toBeNull();
    expect(screenProps.last?.state).toBeDefined();
  });

  it('says the tree could not be read, and draws nothing else, when the skills section is not usable', () => {
    const payload = offlinePayload();
    accountState.current = loaded({
      ...payload,
      fidelity: { ...payload.fidelity, skills: { status: 'missing' } } as AccountPayload['fidelity'],
    });
    const markup = html();
    expect(markup).toContain('data-testid="skills-view"');
    expect(markup).toContain(en.skillsUnreadableTitle);
    expect(markup).not.toContain('data-testid="skill-tree-screen"');
    expect(screenProps.last).toBeNull();
  });

  it('shows the loading state while the account has not arrived', () => {
    accountState.current = { status: 'loading', applied: 0, key: null };
    expect(html()).toContain(en.accountLoadingTitle);
  });

  it('carries the read failure as diagnostic data, never as copy', () => {
    accountState.current = { status: 'error', message: 'ENOENT account.db', applied: 0, key: null };
    const markup = html();
    expect(markup).toContain(en.errorAccountReadFailed);
    expect(markup).toContain('data-account-error-detail="ENOENT account.db"');
  });
});
