import type { AppEnv } from './env.js';

export type BootRecord = {
  scope: 'main' | 'preload' | 'renderer';
  event: 'boot';
  flavor: AppEnv['flavor'];
  appId: string;
  userDataPath: string;
  isPackaged: boolean;
  updateChannel: string;
  productName: string;
};

export function createBootRecord(
  env: AppEnv,
  scope: BootRecord['scope'],
): BootRecord {
  return {
    scope,
    event: 'boot',
    flavor: env.flavor,
    appId: env.appId,
    userDataPath: env.userDataPath,
    isPackaged: env.isPackaged,
    updateChannel: env.descriptor.updateChannel ?? 'none',
    productName: env.productName,
  };
}
