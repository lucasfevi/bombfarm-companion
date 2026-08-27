import fs from 'node:fs';
import path from 'node:path';
import type { RawGameState, RawHeroEnergy, RawHeroRecord, RawInventoryBag } from '@bombfarm/contracts';

export interface FixtureBundle {
  state: RawGameState;
  inventory: RawInventoryBag;
  heroRecords: RawHeroRecord[];
  heroEnergies: RawHeroEnergy[];
}

function resolveFixturesDir(): string {
  const candidates = [
    path.resolve(process.cwd(), '../../packages/game-data/fixtures'),
    path.join(process.cwd(), 'packages/game-data/fixtures'),
    path.resolve(__dirname, '../../../../packages/game-data/fixtures'),
    path.resolve(__dirname, '../../../packages/game-data/fixtures'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    'game-data fixtures directory not found (needed for BFC_GAME_READER=fixture; these are dev/CI-only fixtures, not shipped in a packaged build)',
  );
}

function loadJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
}

export function loadFixtureBundle(): FixtureBundle {
  const dir = resolveFixturesDir();
  return {
    state: loadJson(path.join(dir, 'state-push-a.json')) as RawGameState,
    inventory: loadJson(path.join(dir, 'inventory-bag-v2.json')) as RawInventoryBag,
    heroRecords: [loadJson(path.join(dir, 'hero-record.json')) as RawHeroRecord],
    heroEnergies: [loadJson(path.join(dir, 'hero-energy.json')) as RawHeroEnergy],
  };
}
