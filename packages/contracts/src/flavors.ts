export type AppFlavor = 'dev' | 'beta' | 'prod';

export type UpdateChannel = 'beta' | 'latest';

export interface FlavorDescriptor {
  flavor: AppFlavor;
  appId: string;
  productName: string;
  badgeLabel: string | null;
  dataDirName: string;
  packageName: string;
  outputDir: string;
  updateChannel: UpdateChannel | null;
  logLevel: { console: 'debug' | false; file: 'debug' | 'info' };
}

export const APP_FLAVORS = ['dev', 'beta', 'prod'] as const satisfies readonly AppFlavor[];

export const FLAVORS: Readonly<Record<AppFlavor, FlavorDescriptor>> = {
  dev: {
    flavor: 'dev',
    appId: 'net.bombfarm.companion.dev',
    productName: 'Bomb Farm Companion (Dev)',
    badgeLabel: 'DEV',
    dataDirName: 'Bomb Farm Companion (Dev)',
    packageName: 'bombfarm-companion-dev',
    outputDir: 'release/dev',
    updateChannel: null,
    logLevel: { console: 'debug', file: 'debug' },
  },
  beta: {
    flavor: 'beta',
    appId: 'net.bombfarm.companion.beta',
    productName: 'Bomb Farm Companion (Beta)',
    badgeLabel: 'BETA',
    dataDirName: 'Bomb Farm Companion (Beta)',
    packageName: 'bombfarm-companion-beta',
    outputDir: 'release/beta',
    updateChannel: 'beta',
    logLevel: { console: false, file: 'info' },
  },
  prod: {
    flavor: 'prod',
    appId: 'net.bombfarm.companion',
    productName: 'Bomb Farm Companion',
    badgeLabel: null,
    dataDirName: 'Bomb Farm Companion',
    packageName: 'bombfarm-companion',
    outputDir: 'release/prod',
    updateChannel: 'latest',
    logLevel: { console: false, file: 'info' },
  },
};

export function getFlavorDescriptor(flavor: AppFlavor): FlavorDescriptor {
  return FLAVORS[flavor];
}

export function isAppFlavor(value: unknown): value is AppFlavor {
  return typeof value === 'string' && (APP_FLAVORS as readonly string[]).includes(value);
}

export function parseFlavorToken(raw: string | undefined | null): AppFlavor | null {
  if (raw === undefined || raw === null) {
    return null;
  }

  const trimmed = raw.trim();
  if (trimmed === '') {
    return null;
  }

  const normalized = trimmed.toLowerCase();
  return isAppFlavor(normalized) ? normalized : null;
}

export class InvalidFlavorError extends Error {
  readonly rejectedValue: string;

  constructor(rejectedValue: string) {
    super(`Invalid BFC_FLAVOR: ${rejectedValue}`);
    this.name = 'InvalidFlavorError';
    this.rejectedValue = rejectedValue;
  }
}

export function resolveBuildFlavor(raw: string | undefined): AppFlavor {
  const parsed = parseFlavorToken(raw);
  if (parsed === null) {
    const rejected = raw === undefined || raw.trim() === '' ? '(unset)' : raw.trim();
    throw new InvalidFlavorError(rejected);
  }
  return parsed;
}

export interface ResolveRuntimeFlavorInput {
  raw: string | undefined;
  isPackaged: boolean;
  bakedFlavor: AppFlavor | null;
}

export interface ResolveRuntimeFlavorResult {
  flavor: AppFlavor;
  envConflict: { requested: string; effective: AppFlavor } | null;
}

export function resolveRuntimeFlavor(input: ResolveRuntimeFlavorInput): ResolveRuntimeFlavorResult {
  const { raw, isPackaged, bakedFlavor } = input;

  if (isPackaged) {
    const effective = parseFlavorToken(bakedFlavor === null ? null : bakedFlavor);
    if (effective === null) {
      const rejected = bakedFlavor === null ? '(missing stamp)' : bakedFlavor;
      throw new InvalidFlavorError(rejected);
    }

    const parsedEnv = parseFlavorToken(raw);
    if (raw !== undefined && raw.trim() !== '' && parsedEnv === null) {
      throw new InvalidFlavorError(raw.trim());
    }
    if (parsedEnv !== null && parsedEnv !== effective) {
      return {
        flavor: effective,
        envConflict: { requested: parsedEnv, effective },
      };
    }

    return { flavor: effective, envConflict: null };
  }

  const parsed = parseFlavorToken(raw);
  if (parsed === null) {
    if (raw === undefined || raw.trim() === '') {
      return { flavor: 'dev', envConflict: null };
    }
    throw new InvalidFlavorError(raw.trim());
  }

  return { flavor: parsed, envConflict: null };
}
