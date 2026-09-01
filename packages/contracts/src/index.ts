import type { AppFlavor, UpdateChannel } from './flavors.js';
import type { SettingsWriteResult } from './locale.js';
import type { LiveDiagnosticsDumpOutcome, LiveEvent, LiveView } from './live-source.js';
import type { UpdateStatus } from './update.js';
import type { MarketQuoteResult, MarketQuoteTarget, MarketSnapshotView } from './market.js';

export { accountChangeKey, canonicalStringify } from './account-change-key.js';
/** The desktop locale token, its one domain/BCP-47 mapping, and the pure
 *  startup resolution. `locale.ts` itself imports `AppSettings`/`DEFAULT_SETTINGS` back from this
 *  file (see its own doc comment) — safe because every such value is read only inside a function
 *  body, never at either module's top level, so the two modules finish initialising before either
 *  is actually called. */
export * from './locale.js';
export { disabledUpdateStatus, idleUpdateStatus, initialUpdateStatus } from './update.js';
export type { UpdateErrorReason, UpdatePhase, UpdateStatus } from './update.js';
export { isTrustworthySection } from './account-payload.js';
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
  FieldDrop,
  HouseSnapshot,
  RotationHeroActivity,
  RotationHeroSnapshot,
  RotationNormalizeResult,
  RotationSnapshot,
} from './rotation-snapshot.js';
export type {
  CountdownBasis,
  FieldCountdown,
  LiveCurrency,
  LiveDiagnosticsDumpOutcome,
  LiveDiagnosticsDumpReason,
  LiveEarnings,
  LiveEvent,
  LiveFrame,
  LiveGapReason,
  LiveHeroEnergy,
  LiveHit,
  LiveLootPop,
  LiveMap,
  LiveMapEconomy,
  LiveTick,
  LiveTickHero,
  LiveView,
  RecoveryCountdown,
} from './live-source.js';
export { energyDisplayPercent, isActionableGap, isConnectedCurrency, isLiveCurrency, liveGap, LIVE_DISPLAY_REFRESH_MS } from './live-source.js';
export type {
  MarketQuoteCurrency,
  MarketQuoteFailureReason,
  MarketQuoteResult,
  MarketQuoteTarget,
  MarketSnapshotError,
  MarketSnapshotSource,
  MarketSnapshotView,
} from './market.js';
export { MARKET_QUOTE_CURRENCY, emptyMarketSnapshotView, isMarketQuoteTarget } from './market.js';
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
  schemaVersion: 2;
  locale: 'en' | 'pt-BR';
  alwaysOnTopMain: boolean;
  alwaysOnTopMini: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: 2,
  locale: 'en',
  alwaysOnTopMain: false,
  alwaysOnTopMini: false,
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
  /** The resolved settings: a stored override, else OS detection, else
   *  `DEFAULT_SETTINGS.locale`. No longer the constant it returned since MP1. */
  'settings:get': { args: []; result: AppSettings };
  /** Verb-shaped, following the consent quartet's shape: the existing
   *  `bfc:invoke` bridge forwards no arguments (`preload/index.ts:18`), so the channel name
   *  itself *is* the value rather than a payload the bridge would need to widen to carry.
   *  `isIpcChannel` is already the allowlist validator for it. */
  'settings:useEnglish': { args: []; result: SettingsWriteResult };
  'settings:usePortuguese': { args: []; result: SettingsWriteResult };
  'settings:setAlwaysOnTopMain': { args: [boolean]; result: SettingsWriteResult };
  'storage:health': { args: []; result: { binding: string; ok: boolean } };
  'game:getStatus': { args: []; result: GameStatusInfo };
  'account:get': { args: []; result: AccountView };
  /** Consent for the game-API account reader. All four are
   *  zero-arg by design: the existing `bfc:invoke` bridge forwards no arguments, so the
   *  player's answer is three verbs (`accept`/`decline`/`revoke`) rather than one call taking a
   *  decision parameter. Every result is the new `ConsentRecord`, never the raw `SessionToken`. */
  'consent:get': { args: []; result: ConsentRecord };
  'consent:accept': { args: []; result: ConsentRecord };
  'consent:decline': { args: []; result: ConsentRecord };
  'consent:revoke': { args: []; result: ConsentRecord };
  'live:get': { args: []; result: LiveView };
  /** The manual counterpart to the ring's existing parse-failure trigger (`frame-ring.ts`) — a
   *  player-initiated write of the same scrubbed dump, so it can be attached to a bug report. */
  'live:dumpDiagnostics': { args: []; result: LiveDiagnosticsDumpOutcome };
  /** Zeroes the session gold/XP totals and the session clock. The rolling 10-minute window is left
   *  alone — it is defined by the clock, not by a start point. */
  'live:resetEarnings': { args: []; result: null };
  /** Zero-arg like every channel above: the `bfc:invoke` bridge forwards no arguments, so the
   *  channel name is the verb. Each returns the status the call left behind, and the same value
   *  also arrives on `updates:changed` for every observer. */
  /** Zero-arg, so the channel name is the verb. Each returns the status the call left behind, and
   *  the same value also arrives on `updates:changed` for every observer. */
  'updates:get': { args: []; result: UpdateStatus };
  'updates:check': { args: []; result: UpdateStatus };
  'updates:download': { args: []; result: UpdateStatus };
  /** Quits and relaunches into the installer. Returns the status it acted on; when the phase is
   *  not `ready` it is a no-op and the unchanged status comes back. */
  'updates:installOnRestart': { args: []; result: UpdateStatus };
  'market:getSnapshot': { args: []; result: MarketSnapshotView };
  /** The first channel to carry an argument. Its target is re-validated in main with
   *  `isMarketQuoteTarget` before anything acts on it — the renderer is not trusted to have sent
   *  a well-formed one. */
  'market:refreshItem': { args: [MarketQuoteTarget]; result: MarketQuoteResult };
}

export type IpcInvokeChannel = keyof IpcChannels;

export type IpcInvokeArgs<C extends IpcInvokeChannel> = IpcChannels[C]['args'];
export type IpcInvokeResult<C extends IpcInvokeChannel> = IpcChannels[C]['result'];

export const IPC_CHANNELS = [
  'app:getFlavor',
  'app:getEnvironment',
  'app:ping',
  'settings:get',
  'settings:useEnglish',
  'settings:usePortuguese',
  'settings:setAlwaysOnTopMain',
  'storage:health',
  'game:getStatus',
  'account:get',
  'consent:get',
  'consent:accept',
  'consent:decline',
  'consent:revoke',
  'live:get',
  'live:dumpDiagnostics',
  'live:resetEarnings',
  'updates:get',
  'updates:check',
  'updates:download',
  'updates:installOnRestart',
  'market:getSnapshot',
  'market:refreshItem',
] as const satisfies readonly IpcInvokeChannel[];

export type IpcEventChannel =
  | 'game:status'
  | 'consent:changed'
  | 'account:changed'
  | 'live:event'
  | 'updates:changed'
  | 'market:changed';

export interface IpcEvents {
  'game:status': GameStatusInfo;
  /** Fired whenever the consent record changes, from any cause (accept/decline/revoke). */
  'consent:changed': ConsentRecord;
  /**
   * Fired when the account genuinely **changed**, not on every commit.
   * Two producers can trigger it: the account-refresh cycle (the 60 s game-API poll) and,
   * in fixture-mode test builds only, `GameReaderService`'s fixture ticker. Both are gated by the
   * same `accountChangeKey(payload)` comparison (`packages/contracts/src/account-change-key.ts`)
   * against the last-emitted key — a commit whose key is unchanged from the last emit is
   * suppressed, not forwarded.
   */
  'account:changed': AccountView;
  'live:event': LiveEvent;
  /** Every transition of the updater state machine, including the ones nobody asked for
   *  (download progress, the six-hourly background check). */
  'updates:changed': UpdateStatus;
  /** Fired whenever main adopts a different snapshot body, or merges a fresh per-item quote into
   *  the one it holds. A check that changed nothing (a 304, a failed fetch) does not fire it. */
  'market:changed': MarketSnapshotView;
}

export const IPC_EVENT_CHANNELS = [
  'game:status',
  'consent:changed',
  'account:changed',
  'live:event',
  'updates:changed',
  'market:changed',
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
