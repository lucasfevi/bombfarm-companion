import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => '/appdata',
    getAppPath: () => '/app',
  },
}));

const logState = vi.hoisted(() => ({
  transports: {
    file: { level: undefined as string | false | undefined },
    console: { level: undefined as string | false | undefined },
  },
  info: vi.fn(),
}));

vi.mock('electron-log/main.js', () => ({
  default: {
    transports: logState.transports,
    info: logState.info,
  },
}));

import { APP_FLAVORS } from '@bombfarm/contracts';
import { buildAppEnv } from './env.js';
import { configureLogging } from './logging.js';

describe('configureLogging', () => {
  for (const flavor of APP_FLAVORS) {
    it(`sets log levels from the ${flavor} descriptor`, () => {
      logState.transports.file.level = undefined;
      logState.transports.console.level = undefined;

      const env = buildAppEnv({
        rawFlavor: flavor,
        isPackaged: flavor !== 'dev',
        bakedFlavor: flavor !== 'dev' ? flavor : null,
        appDataPath: '/appdata',
        nodeEnv: flavor === 'dev' ? 'development' : 'production',
      });

      configureLogging(env);

      expect(logState.transports.file.level).toBe(env.descriptor.logLevel.file);
      expect(logState.transports.console.level).toBe(env.descriptor.logLevel.console);
    });
  }

  it('uses debug console and file levels for dev', () => {
    const env = buildAppEnv({
      rawFlavor: 'dev',
      isPackaged: false,
      bakedFlavor: null,
      appDataPath: '/appdata',
      nodeEnv: 'development',
    });
    configureLogging(env);
    expect(logState.transports.file.level).toBe('debug');
    expect(logState.transports.console.level).toBe('debug');
  });

  it('uses info file and disabled console for installed flavors', () => {
    for (const flavor of ['nightly', 'beta', 'prod'] as const) {
      const env = buildAppEnv({
        rawFlavor: flavor,
        isPackaged: true,
        bakedFlavor: flavor,
        appDataPath: '/appdata',
        nodeEnv: 'production',
      });
      configureLogging(env);
      expect(logState.transports.file.level).toBe('info');
      expect(logState.transports.console.level).toBe(false);
    }
  });
});
