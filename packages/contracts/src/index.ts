export type AppFlavor = 'dev' | 'prod';

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

export interface IpcChannels {
  'app:getFlavor': { args: []; result: AppFlavor };
  'app:ping': { args: []; result: { ok: true; from: 'main' } };
  'settings:get': { args: []; result: AppSettings };
  'storage:health': { args: []; result: { binding: string; ok: boolean } };
  'game:getStatus': { args: []; result: GameStatusInfo };
  'game:getSnapshot': { args: []; result: GameSnapshotPayload };
}

export type IpcInvokeChannel = keyof IpcChannels;

export type IpcInvokeArgs<C extends IpcInvokeChannel> = IpcChannels[C]['args'];
export type IpcInvokeResult<C extends IpcInvokeChannel> = IpcChannels[C]['result'];

export const IPC_CHANNELS = [
  'app:getFlavor',
  'app:ping',
  'settings:get',
  'storage:health',
  'game:getStatus',
  'game:getSnapshot',
] as const satisfies readonly IpcInvokeChannel[];

export type IpcEventChannel = 'game:status' | 'snapshot:updated';

export interface IpcEvents {
  'game:status': GameStatusInfo;
  'snapshot:updated': GameSnapshotPayload;
}

export const IPC_EVENT_CHANNELS = [
  'game:status',
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
