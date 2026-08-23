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
  /** Explicit user-data directory override, honoured only when `isPackaged === false`. A
   * packaged app must not be redirectable by an environment variable — the installed flavor's
   * data directory is what upgrades and support expect to find, so the override is silently
   * ignored (never trusted) once the app is packaged, regardless of who set it. */
  userDataOverride?: string | undefined;
  rendererUrlOverride?: string | undefined;
}): AppEnv {
  const { flavor, envConflict } = resolveRuntimeFlavor({
    raw: deps.rawFlavor,
    isPackaged: deps.isPackaged,
    bakedFlavor: deps.bakedFlavor,
  });
  const descriptor = getFlavorDescriptor(flavor);
  const userDataPath =
    !deps.isPackaged && deps.userDataOverride
      ? deps.userDataOverride
      : path.join(deps.appDataPath, descriptor.dataDirName);

  return {
    flavor,
    descriptor,
    // Every term is a positive assertion, so an unset environment can never mean dev.
    isDev:
      !deps.isPackaged &&
      (deps.rendererUrlOverride !== undefined || deps.nodeEnv === 'development'),
    isPackaged: deps.isPackaged,
    appId: descriptor.appId,
    productName: descriptor.productName,
    userDataPath,
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
    userDataOverride: process.env.BFC_USER_DATA_DIR,
    rendererUrlOverride: process.env.BFC_RENDERER_URL,
  });
  return cachedEnv;
}

export { InvalidFlavorError };
