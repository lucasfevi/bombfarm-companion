import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MARKET_APP_ID } from '@bombfarm/pricing';
import { describe, expect, it, vi } from 'vitest';
import { askSteam, isSteamAppUpdating, parseStateFlags, type SteamLaunchDeps } from './steam-launch.js';

const STEAM_PATH = 'C:\\Program Files (x86)\\Steam';
const MANIFEST_PATH = join(STEAM_PATH, 'steamapps', `appmanifest_${String(MARKET_APP_ID)}.acf`);

function manifest(stateFlags: string): string {
  return [
    '"AppState"',
    '{',
    `\t"appid"\t\t"${String(MARKET_APP_ID)}"`,
    '\t"universe"\t\t"1"',
    '\t"LauncherPath"\t\t"C:\\\\Program Files (x86)\\\\Steam\\\\steam.exe"',
    `\t"StateFlags"\t\t"${stateFlags}"`,
    '\t"installdir"\t\t"Bomb Farm"',
    '\t"SizeOnDisk"\t\t"274877906"',
    '}',
    '',
  ].join('\n');
}

function fakeDeps(overrides: Partial<SteamLaunchDeps> = {}): {
  deps: SteamLaunchDeps;
  launch: ReturnType<typeof vi.fn>;
} {
  const launch = vi.fn();
  return {
    launch,
    deps: {
      readSteamPath: () => STEAM_PATH,
      readTextFile: (filePath: string) => (filePath === MANIFEST_PATH ? manifest('4') : null),
      launch,
      ...overrides,
    },
  };
}

describe('parseStateFlags', () => {
  it('reads the StateFlags value out of a real manifest body', () => {
    expect(parseStateFlags(manifest('4'))).toBe(4);
    expect(parseStateFlags(manifest('1026'))).toBe(1026);
  });

  it('is null when the text carries no such key', () => {
    expect(parseStateFlags('"AppState"\n{\n\t"appid"\t\t"4892010"\n}\n')).toBeNull();
    expect(parseStateFlags('')).toBeNull();
    expect(parseStateFlags('not a manifest at all')).toBeNull();
  });
});

describe('isSteamAppUpdating', () => {
  it('a fully installed idle app is not updating', () => {
    expect(isSteamAppUpdating(4)).toBe(false);
    expect(isSteamAppUpdating(0)).toBe(false);
  });

  it('every documented busy bit counts, on its own or alongside the installed bit', () => {
    expect(isSteamAppUpdating(256)).toBe(true);
    expect(isSteamAppUpdating(1 << 20)).toBe(true);
    expect(isSteamAppUpdating(1024)).toBe(true);
    expect(isSteamAppUpdating(1 << 17)).toBe(true);
    expect(isSteamAppUpdating(1 << 18)).toBe(true);
    expect(isSteamAppUpdating(1 << 19)).toBe(true);
    expect(isSteamAppUpdating(1 << 21)).toBe(true);
    expect(isSteamAppUpdating(1 << 22)).toBe(true);
    expect(isSteamAppUpdating(4 | (1 << 20))).toBe(true);
  });

  it('bits outside the busy set are not mistaken for an update', () => {
    expect(isSteamAppUpdating(2)).toBe(false);
    expect(isSteamAppUpdating(6)).toBe(false);
    expect(isSteamAppUpdating(1 << 16)).toBe(false);
  });
});

describe('askSteam', () => {
  it('asks Steam to launch by app id and reports that it asked', async () => {
    const { deps, launch } = fakeDeps();

    await expect(askSteam(deps)).resolves.toBe('asked');

    expect(launch).toHaveBeenCalledTimes(1);
    expect(launch).toHaveBeenCalledWith(join(STEAM_PATH, 'steam.exe'), ['-applaunch', '4892010']);
  });

  it('skips the ask while the app is mid-update, and spawns nothing', async () => {
    const { deps, launch } = fakeDeps({
      readTextFile: (filePath: string) => (filePath === MANIFEST_PATH ? manifest(String(1 << 20)) : null),
    });

    await expect(askSteam(deps)).resolves.toBe('updating');

    expect(launch).not.toHaveBeenCalled();
  });

  it('asks anyway when the manifest is missing — a manifest we cannot find is not an update', async () => {
    const { deps, launch } = fakeDeps({ readTextFile: () => null });

    await expect(askSteam(deps)).resolves.toBe('asked');

    expect(launch).toHaveBeenCalledTimes(1);
  });

  it('asks anyway when the manifest is unparseable', async () => {
    const { deps, launch } = fakeDeps({ readTextFile: () => '\u0000garbled{{{ not vdf' });

    await expect(askSteam(deps)).resolves.toBe('asked');

    expect(launch).toHaveBeenCalledTimes(1);
  });

  it('is unavailable, and spawns nothing, when Steam itself cannot be located', async () => {
    const { deps, launch } = fakeDeps({ readSteamPath: () => null });

    await expect(askSteam(deps)).resolves.toBe('unavailable');

    expect(launch).not.toHaveBeenCalled();
  });

  it('reports a throwing spawn as unavailable instead of letting it escape', async () => {
    const { deps } = fakeDeps({
      launch: () => {
        throw new Error('ENOENT');
      },
    });

    await expect(askSteam(deps)).resolves.toBe('unavailable');
  });

  it('finds a manifest that lives in a second Steam library', async () => {
    const libraryRoot = 'D:\\SteamLibrary';
    const otherManifest = join(libraryRoot, 'steamapps', `appmanifest_${String(MARKET_APP_ID)}.acf`);
    const libraryFolders = [
      '"libraryfolders"',
      '{',
      '\t"0"',
      '\t{',
      `\t\t"path"\t\t"${STEAM_PATH.replace(/\\/g, '\\\\')}"`,
      '\t}',
      '\t"1"',
      '\t{',
      `\t\t"path"\t\t"${libraryRoot.replace(/\\/g, '\\\\')}"`,
      '\t}',
      '}',
      '',
    ].join('\n');

    const { deps, launch } = fakeDeps({
      readTextFile: (filePath: string) => {
        if (filePath === join(STEAM_PATH, 'steamapps', 'libraryfolders.vdf')) return libraryFolders;
        if (filePath === otherManifest) return manifest(String(1 << 20));
        return null;
      },
    });

    await expect(askSteam(deps)).resolves.toBe('updating');

    expect(launch).not.toHaveBeenCalled();
  });

  it('does not declare an app id of its own — the launch argument is the shared market app id', async () => {
    const { deps, launch } = fakeDeps();

    await askSteam(deps);

    expect(launch.mock.calls[0]?.[1]).toEqual(['-applaunch', String(MARKET_APP_ID)]);
    expect(MARKET_APP_ID).toBe(4892010);
  });
});

describe('the source itself', () => {
  const source = readFileSync(join(__dirname, 'steam-launch.ts'), 'utf8');

  it('names Steam as the only executable it will ever reach for', () => {
    expect(source.match(/[\w-]+\.exe/gi) ?? []).toEqual(['steam.exe']);
  });

  it('has no way to stop anything', () => {
    expect(source).not.toMatch(/taskkill/i);
    expect(source).not.toMatch(/process\.kill/);
  });

  it('spells the app id once, by import', () => {
    expect(source).toContain('MARKET_APP_ID');
    expect(source).not.toContain('4892010');
  });
});
