import path from 'node:path';
import { readFileSync } from 'node:fs';
import { app } from 'electron';
import {
  InvalidFlavorError,
  getFlavorDescriptor,
  isAppFlavor,
  resolveRuntimeFlavor,
  type AppFlavor,
  type FlavorDescriptor,
} from '@bombfarm/contracts';

export interface AppEnv {
  flavor: AppFlavor;
  descriptor: FlavorDescriptor;
  isDev: boolean;
  isPackaged: boolean;
  appId: string;
  productName: string;
  userDataPath: string;
  envConflict: { requested: string; effective: AppFlavor } | null;
}

export function buildAppEnv(deps: {
  rawFlavor: string | undefined;
  isPackaged: boolean;
  bakedFlavor: AppFlavor | null;
  appDataPath: string;
  nodeEnv: string | undefined;
}): AppEnv {
  const { flavor, envConflict } = resolveRuntimeFlavor({
    raw: deps.rawFlavor,
    isPackaged: deps.isPackaged,
    bakedFlavor: deps.bakedFlavor,
  });
  const descriptor = getFlavorDescriptor(flavor);

  return {
    flavor,
    descriptor,
    isDev: deps.nodeEnv !== 'production',
    isPackaged: deps.isPackaged,
    appId: descriptor.appId,
    productName: descriptor.productName,
    userDataPath: path.join(deps.appDataPath, descriptor.dataDirName),
    envConflict,
  };
}

export const RENDERER_DEV_URL =
  process.env.BFC_RENDERER_URL ?? 'http://127.0.0.1:3000';

let cachedEnv: AppEnv | null = null;

function readBakedFlavor(): AppFlavor | null {
  try {
    const packageJsonPath = path.join(app.getAppPath(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      bfcFlavor?: unknown;
    };
    return isAppFlavor(packageJson.bfcFlavor) ? packageJson.bfcFlavor : null;
  } catch {
    return null;
  }
}

export function resolveAppEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = buildAppEnv({
    rawFlavor: process.env.BFC_FLAVOR,
    isPackaged: app.isPackaged,
    bakedFlavor: readBakedFlavor(),
    appDataPath: app.getPath('appData'),
    nodeEnv: process.env.NODE_ENV,
  });
  return cachedEnv;
}

export { InvalidFlavorError };
