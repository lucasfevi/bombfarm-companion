import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => '/appdata',
    getAppPath: () => '/app',
  },
}));

import { APP_FLAVORS, FLAVORS } from '@bombfarm/contracts';
import { buildAppEnv } from './env.js';
import { createBootRecord } from './boot-record.js';

const APP_DATA = '/appdata';

function envForFlavor(flavor: (typeof APP_FLAVORS)[number]) {
  return buildAppEnv({
    rawFlavor: flavor,
    isPackaged: flavor !== 'dev',
    bakedFlavor: flavor !== 'dev' ? flavor : null,
    appDataPath: APP_DATA,
    nodeEnv: flavor === 'dev' ? 'development' : 'production',
  });
}

describe('createBootRecord', () => {
  for (const flavor of APP_FLAVORS) {
    it(`builds the boot record for ${flavor}`, () => {
      const env = envForFlavor(flavor);
      const record = createBootRecord(env, 'main');

      expect(record).toEqual({
        scope: 'main',
        event: 'boot',
        flavor,
        appId: FLAVORS[flavor].appId,
        userDataPath: env.userDataPath,
        isPackaged: flavor !== 'dev',
        updateChannel: FLAVORS[flavor].updateChannel ?? 'none',
        productName: FLAVORS[flavor].productName,
      });
    });
  }

  it('uses the provided scope', () => {
    const env = envForFlavor('beta');
    expect(createBootRecord(env, 'renderer').scope).toBe('renderer');
  });
});
