import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({
  fetch: vi.fn(),
  isEncryptionAvailable: vi.fn(),
  encryptString: vi.fn(),
  decryptString: vi.fn(),
  openExternal: vi.fn(),
}));

vi.mock('electron', () => ({
  net: { fetch: electron.fetch },
  safeStorage: {
    isEncryptionAvailable: electron.isEncryptionAvailable,
    encryptString: electron.encryptString,
    decryptString: electron.decryptString,
  },
  shell: { openExternal: electron.openExternal },
}));

import type { PremiumView } from '@bombfarm/contracts';
import { createElectronPremium, createSafeStorageBox } from './index.js';
import { PREMIUM_API_ORIGIN } from './premium-transport.js';
import { settle } from './premium-test-support.js';

const APPROVAL_URL = 'https://approve.invalid/start/approval-fixture-6e21d0';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function requestedUrls(): string[] {
  return electron.fetch.mock.calls.map((call) => String(call[0]));
}

function build(originOverride: string | null) {
  const records: Record<string, unknown>[] = [];
  const views: PremiumView[] = [];
  const keep = (record: Record<string, unknown>): void => {
    records.push(record);
  };
  const service = createElectronPremium({
    db: null,
    originOverride,
    readGameIdentity: () => null,
    log: { info: keep, warn: keep, error: keep },
    onChanged: (view) => {
      views.push(view);
    },
  });
  return { service, records, views };
}

beforeEach(() => {
  electron.fetch.mockReset();
  electron.isEncryptionAvailable.mockReset();
  electron.encryptString.mockReset();
  electron.decryptString.mockReset();
  electron.openExternal.mockReset();
  electron.openExternal.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('which origin the service talks to', () => {
  it('uses the real API origin when no override is given', async () => {
    electron.fetch.mockResolvedValue(json(200, { visible: false }));
    const { service } = build(null);

    service.start();
    await settle();
    service.stop();

    expect(requestedUrls()).toEqual([`${PREMIUM_API_ORIGIN}/v1/premium/visibility`]);
  });

  it('uses the override when one is given', async () => {
    electron.fetch.mockResolvedValue(json(200, { visible: false }));
    const { service } = build('http://127.0.0.1:4555');

    service.start();
    await settle();
    service.stop();

    expect(requestedUrls()).toEqual(['http://127.0.0.1:4555/v1/premium/visibility']);
  });
});

describe('the secret box', () => {
  it('asks the operating system whether encryption is available', () => {
    electron.isEncryptionAvailable.mockReturnValueOnce(true).mockReturnValueOnce(false);
    const box = createSafeStorageBox();

    expect(box.isAvailable()).toBe(true);
    expect(box.isAvailable()).toBe(false);
  });

  it('encrypts and decrypts through safeStorage and nothing else', () => {
    const cipher = Buffer.from('sealed-fixture');
    electron.encryptString.mockReturnValue(cipher);
    electron.decryptString.mockReturnValue('plain-fixture');
    const box = createSafeStorageBox();

    expect(box.encrypt('plain-fixture')).toBe(cipher);
    expect(electron.encryptString).toHaveBeenCalledWith('plain-fixture');
    expect(box.decrypt(cipher)).toBe('plain-fixture');
    expect(electron.decryptString).toHaveBeenCalledWith(cipher);
  });
});

describe('opening the sign-in page', () => {
  it('hands the approval URL to the system browser directly and logs nothing that holds it', async () => {
    electron.fetch.mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith('/v1/auth/desktop/requests')
          ? json(201, { approvalUrl: APPROVAL_URL, expiresAt: '2026-10-20T12:10:00.000Z' })
          : json(200, { visible: false }),
      ),
    );
    const { service, records, views } = build('http://127.0.0.1:4555');
    service.start();

    expect(await service.signIn()).toEqual({ ok: true });

    expect(electron.openExternal).toHaveBeenCalledTimes(1);
    expect(electron.openExternal).toHaveBeenCalledWith(APPROVAL_URL);
    expect(service.getView().session).toBe('signing-in');
    expect(JSON.stringify(records)).not.toContain(APPROVAL_URL);
    expect(JSON.stringify(views)).not.toContain(APPROVAL_URL);

    expect(service.cancelSignIn()).toBe(true);
    service.stop();
  });
});
