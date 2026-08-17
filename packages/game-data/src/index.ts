export { pickHighestGoldCandidate, MAX_CANDIDATES, type MemoryCandidate } from './candidates.js';
export { looksLikeFormatString, isPlausibleId, isPlausibleDefId, parseNumericField, isRecord } from './validation.js';
export {
  classifyInventoryBag,
  parseInventoryBag,
  type InventoryParseOutput,
} from './parsers/inventory.js';
export {
  classifyGameState,
  parseGameState,
  extractJsonObjects,
  type StateParseOutput,
} from './parsers/state.js';
export {
  classifyHeroRecord,
  classifyHeroEnergy,
  mapHeroRecord,
  mapHeroEnergy,
  mergeHeroSummaries,
} from './parsers/heroes.js';
export { buildSnapshot, classifyParsedObjects, type BuildSnapshotInput } from './snapshot.js';
export * from './attribution/index.js';

export const GAME_DATA_PACKAGE = '@bombfarm/game-data' as const;

export function gameDataReady(): boolean {
  return true;
}
