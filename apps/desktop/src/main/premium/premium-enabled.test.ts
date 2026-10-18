import { beforeEach, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({
  fetch: vi.fn(),
  isEncryptionAvailable: vi.fn(),
  openExternal: vi.fn(),
}));

const transport = vi.hoisted(() => ({ createPremiumHttp: vi.fn() }));

vi.mock('electron', () => ({
  net: { fetch: electron.fetch },
  safeStorage: {
    isEncryptionAvailable: electron.isEncryptionAvailable,
    encryptString: vi.fn(),
    decryptString: vi.fn(),
  },
  shell: { openExternal: electron.openExternal },
}));

vi.mock('./premium-transport.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./premium-transport.js')>();
  transport.createPremiumHttp.mockImplementation(actual.createPremiumHttp);
  return { ...actual, createPremiumHttp: transport.createPremiumHttp };
});

import { FLAVORS } from '@bombfarm/contracts';
import { createPremiumWhenEnabled } from './index.js';

function deps() {
  return {
    db: null,
    originOverride: null,
    offline: false,
    readGameIdentity: () => null,
    locale: () => 'en' as const,
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    onChanged: vi.fn(),
  };
}

beforeEach(() => {
  electron.fetch.mockReset();
  transport.createPremiumHttp.mockClear();
});

describe('building the Premium service per flavor', () => {
  it.each(['beta', 'prod'] as const)('creates no service and no transport in the %s flavor', (flavor) => {
    const service = createPremiumWhenEnabled(FLAVORS[flavor].premium, deps());

    expect(service).toBeNull();
    expect(transport.createPremiumHttp).not.toHaveBeenCalled();
    expect(electron.fetch).not.toHaveBeenCalled();
  });

  it('creates the service and its transport in the dev flavor', () => {
    const service = createPremiumWhenEnabled(FLAVORS.dev.premium, deps());

    expect(service).not.toBeNull();
    expect(transport.createPremiumHttp).toHaveBeenCalledTimes(1);
  });
});
