import log from 'electron-log/main.js';
import type { AppFlavor } from '@bombfarm/contracts';
import { resolveAppEnv } from './env.js';

export function configureLogging(flavor: AppFlavor): typeof log {
  log.transports.file.level = flavor === 'dev' ? 'debug' : 'info';
  log.transports.console.level = flavor === 'dev' ? 'debug' : false;

  log.info({
    scope: 'main',
    event: 'logging.configured',
    flavor,
    node: process.versions.node,
    electron: process.versions.electron,
  });

  return log;
}

export function logBootLine(scope: 'main' | 'preload' | 'renderer'): void {
  const env = resolveAppEnv();
  log.info({
    scope,
    event: 'boot',
    flavor: env.flavor,
    productName: env.productName,
  });
}

export { log };
