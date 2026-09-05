import { execFile, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MARKET_APP_ID } from '@bombfarm/pricing';

export type SteamAskOutcome = 'asked' | 'updating' | 'unavailable';

export interface SteamLaunchDeps {
  readSteamPath: () => string | null;
  readTextFile: (filePath: string) => string | null;
  launch: (steamExe: string, args: readonly string[]) => void;
}

/** From Steam's app-state enumeration: UpdateRunning 256, UpdateStarted 1024, Validating 1 << 17,
 *  AddingFiles 1 << 18, Preallocating 1 << 19, Downloading 1 << 20, Staging 1 << 21,
 *  Committing 1 << 22. A fully installed idle app reads 4, which shares no bit with these. */
const BUSY_UPDATING_FLAGS =
  256 | 1024 | (1 << 17) | (1 << 18) | (1 << 19) | (1 << 20) | (1 << 21) | (1 << 22);

const MANIFEST_FILE_NAME = `appmanifest_${String(MARKET_APP_ID)}.acf`;

export function parseStateFlags(acfText: string): number | null {
  const value = /"StateFlags"\s*"(\d+)"/.exec(acfText)?.[1];
  return value === undefined ? null : Number.parseInt(value, 10);
}

export function isSteamAppUpdating(flags: number): boolean {
  return (flags & BUSY_UPDATING_FLAGS) !== 0;
}

function libraryRoots(steamPath: string, readTextFile: SteamLaunchDeps['readTextFile']): string[] {
  const vdf = readTextFile(join(steamPath, 'steamapps', 'libraryfolders.vdf'));
  if (vdf === null) {
    return [];
  }

  const roots: string[] = [];
  for (const match of vdf.matchAll(/"path"\s*"([^"]+)"/g)) {
    const value = match[1];
    if (value !== undefined) {
      roots.push(value.replace(/\\\\/g, '\\'));
    }
  }
  return roots;
}

function readAppManifest(steamPath: string, readTextFile: SteamLaunchDeps['readTextFile']): string | null {
  const inSteamsOwnLibrary = readTextFile(join(steamPath, 'steamapps', MANIFEST_FILE_NAME));
  if (inSteamsOwnLibrary !== null) {
    return inSteamsOwnLibrary;
  }

  for (const root of libraryRoots(steamPath, readTextFile)) {
    const text = readTextFile(join(root, 'steamapps', MANIFEST_FILE_NAME));
    if (text !== null) {
      return text;
    }
  }
  return null;
}

export function askSteam(deps: SteamLaunchDeps): Promise<SteamAskOutcome> {
  const steamPath = deps.readSteamPath();
  if (steamPath === null || steamPath === '') {
    return Promise.resolve('unavailable');
  }

  const manifest = readAppManifest(steamPath, deps.readTextFile);
  const flags = manifest === null ? null : parseStateFlags(manifest);
  if (flags !== null && isSteamAppUpdating(flags)) {
    return Promise.resolve('updating');
  }

  try {
    deps.launch(join(steamPath, 'steam.exe'), ['-applaunch', String(MARKET_APP_ID)]);
  } catch {
    return Promise.resolve('unavailable');
  }
  return Promise.resolve('asked');
}

function readSteamPathFromRegistry(): string | null {
  try {
    const output = execFileSync('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    const value = /SteamPath\s+REG_SZ\s+(.+)/.exec(output)?.[1]?.trim();
    return value === undefined || value === '' ? null : value.replace(/\//g, '\\');
  } catch {
    return null;
  }
}

export function createSteamLaunchDeps(): SteamLaunchDeps {
  return {
    readSteamPath: readSteamPathFromRegistry,
    readTextFile: (filePath) => {
      try {
        return readFileSync(filePath, 'utf8');
      } catch {
        return null;
      }
    },
    // Fire and forget: the caller observes the process appearing, so waiting here would only
    // hold a handle open for as long as the game runs.
    launch: (steamExe, args) => {
      execFile(steamExe, [...args], { windowsHide: true }, () => undefined);
    },
  };
}
