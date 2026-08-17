import { describe, expect, it } from 'vitest';
import {
  APP_FLAVORS,
  FLAVORS,
  type AppFlavor,
} from '@bombfarm/contracts';
import {
  applyAppIdentity,
  type AppIdentityInput,
  type AppIdentityPort,
} from './app-identity.js';

type IdentityCall =
  | { method: 'setName'; name: string }
  | { method: 'setAppUserModelId'; id: string }
  | { method: 'setPath'; name: 'userData'; path: string }
  | { method: 'requestSingleInstanceLock' };

function createFakePort(lockResult: boolean): {
  port: AppIdentityPort;
  calls: IdentityCall[];
} {
  const calls: IdentityCall[] = [];

  const port: AppIdentityPort = {
    setName(name: string) {
      calls.push({ method: 'setName', name });
    },
    setAppUserModelId(id: string) {
      calls.push({ method: 'setAppUserModelId', id });
    },
    setPath(name: 'userData', path: string) {
      calls.push({ method: 'setPath', name, path });
    },
    requestSingleInstanceLock() {
      calls.push({ method: 'requestSingleInstanceLock' });
      return lockResult;
    },
  };

  return { port, calls };
}

const APP_DATA = 'C:\\Users\\Tester\\AppData\\Roaming';

function flavorInput(flavor: AppFlavor): AppIdentityInput {
  const descriptor = FLAVORS[flavor];
  return {
    productName: descriptor.productName,
    appId: descriptor.appId,
    userDataPath: `${APP_DATA}\\${descriptor.dataDirName}`,
  };
}

describe('applyAppIdentity', () => {
  it('sets userData before requesting the single-instance lock', () => {
    const { port, calls } = createFakePort(true);
    applyAppIdentity(port, flavorInput('dev'));

    const setPathIndex = calls.findIndex((call) => call.method === 'setPath');
    const lockIndex = calls.findIndex((call) => call.method === 'requestSingleInstanceLock');
    expect(setPathIndex).toBeGreaterThanOrEqual(0);
    expect(lockIndex).toBeGreaterThan(setPathIndex);
  });

  it('returns gotLock true when the lock is acquired', () => {
    const { port } = createFakePort(true);
    expect(applyAppIdentity(port, flavorInput('dev'))).toEqual({ gotLock: true });
  });

  it('returns gotLock false when the lock is not acquired', () => {
    const { port } = createFakePort(false);
    expect(applyAppIdentity(port, flavorInput('dev'))).toEqual({ gotLock: false });
  });

  for (const flavor of APP_FLAVORS) {
    it(`applies descriptor identity for ${flavor}`, () => {
      const { port, calls } = createFakePort(true);
      const descriptor = FLAVORS[flavor];
      const input = flavorInput(flavor);

      applyAppIdentity(port, input);

      expect(calls).toEqual([
        { method: 'setName', name: descriptor.productName },
        { method: 'setAppUserModelId', id: descriptor.appId },
        { method: 'setPath', name: 'userData', path: input.userDataPath },
        { method: 'requestSingleInstanceLock' },
      ]);
    });
  }
});
