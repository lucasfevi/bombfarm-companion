import log from 'electron-log/main.js';
import { createBootRecord } from './boot-record.js';
import type { AppEnv } from './env.js';
import { resolveAppEnv } from './env.js';

export function configureLogging(env: AppEnv): typeof log {
  const { console: consoleLevel, file: fileLevel } = env.descriptor.logLevel;
  log.transports.file.level = fileLevel;
  log.transports.console.level = consoleLevel;

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

export { log };
