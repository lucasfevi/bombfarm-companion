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
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('electron-log/main.js', () => ({
  default: {
    transports: logState.transports,
    info: logState.info,
    warn: logState.warn,
    error: logState.error,
    debug: logState.debug,
  },
}));

import { APP_FLAVORS } from '@bombfarm/contracts';
import { buildAppEnv } from './env.js';
import { configureLogging, log } from './logging.js';

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
    for (const flavor of ['beta', 'prod'] as const) {
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

describe('log: the shared main-process port', () => {
  it('a registered secret never survives into a warn record, even embedded in free text', () => {
    logState.warn.mockClear();
    const secret = 'sentinel-session-token-9f3a7c2e';

    log.registerSecret(secret);
    log.warn({ scope: 'test', event: 'probe', message: `read failed near ${secret}` });

    const emitted = logState.warn.mock.calls.map((call) => JSON.stringify(call[0]));
    expect(emitted.some((json) => json.includes(secret))).toBe(false);
    expect(emitted.some((json) => json.includes('[redacted]'))).toBe(true);
  });

  it('a registered secret is also scrubbed from a debug record', () => {
    logState.debug.mockClear();
    const secret = 'sentinel-debug-path-2c8e4b19';

    log.registerSecret(secret);
    log.debug({ scope: 'test', event: 'probe', detail: `token was ${secret}` });

    const emitted = logState.debug.mock.calls.map((call) => JSON.stringify(call[0]));
    expect(emitted.some((json) => json.includes(secret))).toBe(false);
    expect(emitted.some((json) => json.includes('[redacted]'))).toBe(true);
  });

  it('repeating the same warn record is suppressed until flush()', () => {
    logState.warn.mockClear();

    log.warn({ scope: 'test', event: 'repeat.me' });
    log.warn({ scope: 'test', event: 'repeat.me' });
    log.warn({ scope: 'test', event: 'repeat.me' });
    expect(logState.warn).toHaveBeenCalledTimes(1);

    log.flush();
    expect(logState.warn).toHaveBeenCalledTimes(2);
    expect(logState.warn.mock.calls[1]?.[0]).toMatchObject({ suppressedCount: 2 });
  });
});
