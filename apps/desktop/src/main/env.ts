import type { AppFlavor } from '@bombfarm/contracts';

export interface AppEnv {
  flavor: AppFlavor;
  isDev: boolean;
  appId: string;
  productName: string;
  userDataSuffix: string;
}

export function resolveAppEnv(): AppEnv {
  const flavor: AppFlavor = process.env.BFC_FLAVOR === 'dev' ? 'dev' : 'prod';
  const isDev = process.env.NODE_ENV !== 'production';

  if (flavor === 'dev') {
    return {
      flavor,
      isDev,
      appId: 'net.bombfarm.companion.dev',
      productName: 'Bomb Farm Companion (DEV)',
      userDataSuffix: '-dev',
    };
  }

  return {
    flavor,
    isDev,
    appId: 'net.bombfarm.companion',
    productName: 'Bomb Farm Companion',
    userDataSuffix: '',
  };
}

export const RENDERER_DEV_URL =
  process.env.BFC_RENDERER_URL ?? 'http://127.0.0.1:3000';
