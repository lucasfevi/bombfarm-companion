import type { AppFlavor, UpdateChannel } from './flavors.js';

export { accountChangeKey } from './account-change-key.js';
export type {
  AccountFidelity,
  AccountFidelityGrade,
  AccountFidelityReport,
  AccountPayload,
  AccountSection,
  SectionFidelity,
  SectionStatus,
} from './account-payload.js';
export type {
  AccountStoreReason,
  AccountStoreStatus,
  AccountView,
  RestoredAccount,
  StoredAccountFidelity,
  StoredSectionFidelity,
} from './account-store.js';
import type { AccountView } from './account-store.js';
export type { ConsentDecision, ConsentRecord } from './consent.js';
import type { ConsentRecord } from './consent.js';
export type {
  AppFlavor,
  FlavorDescriptor,
  ResolveRuntimeFlavorInput,
  ResolveRuntimeFlavorResult,
  UpdateChannel,
} from './flavors.js';
export {
  APP_FLAVORS,
  FLAVORS,
  InvalidFlavorError,
  getFlavorDescriptor,
  isAppFlavor,
  parseFlavorToken,
  resolveBuildFlavor,
  resolveRuntimeFlavor,
} from './flavors.js';

export type Rarity = 0 | 1 | 2 | 3 | 4 | 5;
export type Slot = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type ItemKind = 'equipment' | 'gem' | 'key' | 'material';

export interface InventoryItem {
  id: string;
  defId: string;
  kind: ItemKind;
  set: string;
  rarity: Rarity;
  slot: Slot | null;
  level: number;
  upgrade: number;
  power: number;
  stats: { stat: number; value: number; effective: number }[];
  sellValueGold: number;
  tradable: boolean;
  marketState: number;
  locked: boolean;
  equippedOn: string | null;
  equipSlot: Slot | null;
  iconUrl: string;
}

export interface HeroEnergy {
  current: number;
  max: number;
  percent: number;
  state: string;
  inField: boolean;
  inCasa: boolean;
  recovering: boolean;
}

export interface HeroSummary {
  id: string;
  name: string;
  level?: number;
  inField?: boolean;
  energy?: HeroEnergy;
}

export interface Snapshot {
  takenAt: string;
  source: 'live' | 'restored';
  gold: number;
  bagTabs: number;
  bagCapacity: number;
  items: InventoryItem[];
  heroes: HeroSummary[];
  phase?: number;
}

export type GameReaderStatus = 'connected' | 'not_running' | 'stale';

export interface GameStatusInfo {
  status: GameReaderStatus;
  updatedAt: string;
  staleAgeMs?: number;
  processName?: string;
}

export interface RawGameState {
  t?: string;
  gold?: string | number;
  phase?: number;
  wave?: number;
  heroes?: RawStateHero[];
  bombs?: RawBomb[];
  hits?: RawHit[];
  explosions?: RawExplosion[];
  kinds?: number[];
  hps?: number[];
  [key: string]: unknown;
}

export interface RawStateHero {
  id: string;
  c: number;
  x?: number;
  y?: number;
  s?: number;
  w?: number;
  e?: number;
  z?: boolean;
  sk?: number;
}

export interface RawBomb {
  c: number;
  r: number;
  f?: number;
  ft: number;
}

export interface RawHit {
  c: number;
  cr: boolean;
  d: number;
}

export interface RawExplosion {
  c: number;
  r: number;
}

export interface RawInventoryItem {
  id: string;
  def_id: string;
  set?: string;
  rarity?: number;
  slot?: number | null;
  level?: number;
  stats?: { stat: number; value: number; effective: number }[];
  power?: number;
  sell_value?: string | number | null;
  upgrade?: number;
  tradable?: boolean | null;
  market_state?: number;
  market?: boolean;
  locked?: boolean;
  equipped_on?: string | null;
  equip_slot?: number | null;
  [key: string]: unknown;
}

export interface RawInventoryBag {
  items: RawInventoryItem[];
  pending_chests?: unknown[];
  bag_tabs?: number;
  bag_capacity?: number;
  items_count?: number;
  [key: string]: unknown;
}

export interface RawHeroRecord {
  id: string;
  name?: string;
  level?: number;
  in_field?: boolean;
  stats?: {
    cooldown_reduction?: number;
    [key: string]: number | undefined;
  };
  slots?: (string | null)[];
  [key: string]: unknown;
}

export interface RawHeroEnergy {
  id: string;
  energia_atual?: number;
  energia_max?: number;
  energia_pct?: number;
  state?: string;
  in_field?: boolean;
  in_casa?: boolean;
  recovering?: boolean;
  [key: string]: unknown;
}

export interface GameSnapshotPayload {
  status: GameStatusInfo;
  mapped: Snapshot | null;
  raw: {
    state: RawGameState | null;
    inventory: RawInventoryBag | null;
  };
}

export type DmgIdentifiedBy =
  | 'dying_bomb_footprint'
  | 'invisible_cell_cross'
  | 'unattributed';

export interface DamageChunk {
  cell: number;
  amount: number;
  heroId: string | null;
  identifiedBy: DmgIdentifiedBy;
}

export interface DamageAttributionResult {
  chunks: DamageChunk[];
  perHero: Record<string, number>;
  unattributed: number;
  total: number;
}

export interface AppSettings {
  schemaVersion: 1;
  locale: 'en' | 'pt-BR';
}

export const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: 1,
  locale: 'en',
};

export interface AppEnvironmentInfo {
  flavor: AppFlavor;
  productName: string;
  badgeLabel: string | null;
  updateChannel: UpdateChannel | null;
  isPackaged: boolean;
  version: string;
}

export interface IpcChannels {
  'app:getFlavor': { args: []; result: AppFlavor };
  'app:getEnvironment': { args: []; result: AppEnvironmentInfo };
  'app:ping': { args: []; result: { ok: true; from: 'main' } };
  'settings:get': { args: []; result: AppSettings };
  'storage:health': { args: []; result: { binding: string; ok: boolean } };
  'game:getStatus': { args: []; result: GameStatusInfo };
  'game:getSnapshot': { args: []; result: GameSnapshotPayload };
  'account:get': { args: []; result: AccountView };
  /** MP2 F2 — consent for the game-API account reader (LAR-01, LAR-03…05). All four are
   *  zero-arg by design (TD-10): the existing `bfc:invoke` bridge forwards no arguments, so the
   *  player's answer is three verbs (`accept`/`decline`/`revoke`) rather than one call taking a
   *  decision parameter. Every result is the new `ConsentRecord`, never the raw `SessionToken`. */
  'consent:get': { args: []; result: ConsentRecord };
  'consent:accept': { args: []; result: ConsentRecord };
  'consent:decline': { args: []; result: ConsentRecord };
  'consent:revoke': { args: []; result: ConsentRecord };
}

export type IpcInvokeChannel = keyof IpcChannels;

export type IpcInvokeArgs<C extends IpcInvokeChannel> = IpcChannels[C]['args'];
export type IpcInvokeResult<C extends IpcInvokeChannel> = IpcChannels[C]['result'];

export const IPC_CHANNELS = [
  'app:getFlavor',
  'app:getEnvironment',
  'app:ping',
  'settings:get',
  'storage:health',
  'game:getStatus',
  'game:getSnapshot',
  'account:get',
  'consent:get',
  'consent:accept',
  'consent:decline',
  'consent:revoke',
] as const satisfies readonly IpcInvokeChannel[];

export type IpcEventChannel = 'game:status' | 'snapshot:updated' | 'consent:changed' | 'account:changed';

export interface IpcEvents {
  'game:status': GameStatusInfo;
  'snapshot:updated': GameSnapshotPayload;
  /** Fired whenever the consent record changes, from any cause (accept/decline/revoke). */
  'consent:changed': ConsentRecord;
  /**
   * MP3 F3 (`AD-043`) — fired when the account genuinely **changed**, not on every commit.
   * Two producers can trigger it: the MP2 F2 account-refresh cycle (the 60 s game-API poll) and,
   * in fixture-mode test builds only, `GameReaderService`'s fixture ticker. Both are gated by the
   * same `accountChangeKey(payload)` comparison (`packages/contracts/src/account-change-key.ts`)
   * against the last-emitted key — a commit whose key is unchanged from the last emit is
   * suppressed, not forwarded.
   */
  'account:changed': AccountView;
}

export const IPC_EVENT_CHANNELS = [
  'game:status',
  'consent:changed',
  'account:changed',
  'snapshot:updated',
] as const satisfies readonly IpcEventChannel[];

export function isIpcChannel(value: string): value is IpcInvokeChannel {
  return (IPC_CHANNELS as readonly string[]).includes(value);
}

export function isIpcEventChannel(value: string): value is IpcEventChannel {
  return (IPC_EVENT_CHANNELS as readonly string[]).includes(value);
}

export function createPingResponse(from: 'main' | 'preload' | 'renderer'): {
  ok: true;
  from: typeof from;
} {
  return { ok: true, from };
}
