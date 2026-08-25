import rawLog from 'electron-log/main.js';
import type { BoundaryLog } from './boundary-log/index.js';
import { createBoundaryLog } from './boundary-log/index.js';
import { createBootRecord } from './boot-record.js';
import type { AppEnv } from './env.js';
import { resolveAppEnv } from './env.js';

export type MainLog = BoundaryLog;

function createMainLog(): MainLog {
  return createBoundaryLog({
    transport: {
      info: (record) => { rawLog.info(record); },
      warn: (record) => { rawLog.warn(record); },
      error: (record) => { rawLog.error(record); },
      debug: (record) => { rawLog.debug(record); },
    },
    now: () => Date.now(),
  });
}

export const log: MainLog = createMainLog();

export function configureLogging(env: AppEnv): MainLog {
  const { console: consoleLevel, file: fileLevel } = env.descriptor.logLevel;
  rawLog.transports.file.level = fileLevel;
  rawLog.transports.console.level = consoleLevel;

  log.info({
    scope: 'main',
    event: 'logging.configured',
    flavor: env.flavor,
    node: process.versions.node,
    electron: process.versions.electron,
  });

  return log;
}

export function logBootLine(scope: 'main' | 'preload' | 'renderer'): void {
  log.info(createBootRecord(resolveAppEnv(), scope));
}
