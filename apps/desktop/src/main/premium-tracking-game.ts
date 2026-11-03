import { join } from 'node:path';
import { isGranted, type ConsentRecord, type GrantedConsent } from '@bombfarm/game-api';
import {
  battleLogPath,
  createBattleLogReader,
  gameSettingsPath,
  nodeBattleLogFsPort,
  watchGameFolder,
} from './game-api/battle-log-file.js';
import { readSessionSecrets, sessionCfgPath } from './game-api/session-token-file.js';
import type { ElectronTrackingDeps } from './premium/index.js';

export interface PremiumTrackingGameDeps {
  /** The player's current consent; nothing of the game's is read unless it is granted. */
  readonly readConsent: () => ConsentRecord;
  /** Electron's `app.isPackaged`: the only thing that may unlock the test path overrides. */
  readonly isPackaged: boolean;
  /** `process.resourcesPath` of the packaged app. */
  readonly resourcesPath: string;
  /** The folder holding the built main process files. */
  readonly mainDir: string;
}

const EXTENSION_FILE = 'httpfs.duckdb_extension';

/** Where the signed DuckDB extension is: beside the app when packaged, in the build folder otherwise. */
export function trackingExtensionPath(deps: Pick<PremiumTrackingGameDeps, 'isPackaged' | 'resourcesPath' | 'mainDir'>): string {
  return deps.isPackaged
    ? join(deps.resourcesPath, 'duckdb', EXTENSION_FILE)
    : join(deps.mainDir, '..', '..', 'build', 'duckdb', EXTENSION_FILE);
}

/**
 * The game's side of the tracking capabilities, as plain functions for the Premium host: the
 * session credential (to withhold it), the battle log and the game settings, all behind consent.
 * The Premium host is built from this and knows no game file, path or credential type.
 */
export function createPremiumTrackingGame(deps: PremiumTrackingGameDeps): ElectronTrackingDeps {
  const pathDeps = { isPackaged: deps.isPackaged };
  const logPath = battleLogPath(pathDeps);
  const consent = (): GrantedConsent | null => {
    const record = deps.readConsent();
    return isGranted(record) ? record : null;
  };
  return {
    extensionPath: trackingExtensionPath(deps),
    gameSecrets: () => {
      const granted = consent();
      return granted === null ? [] : readSessionSecrets(granted, undefined, sessionCfgPath(pathDeps));
    },
    battleLog: {
      source: createBattleLogReader({
        consent,
        fs: nodeBattleLogFsPort,
        battleLogPath: logPath,
        settingsPath: gameSettingsPath(pathDeps),
      }),
      watch: (wake) => watchGameFolder(logPath, wake),
    },
  };
}
