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

export interface HeroSummary {
  id: string;
  name: string;
}

export interface Snapshot {
  takenAt: string;
  source: 'live' | 'restored';
  gold: number;
  bagTabs: number;
  bagCapacity: number;
  items: InventoryItem[];
  heroes: HeroSummary[];
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
}

export type IpcInvokeChannel = keyof IpcChannels;

export type IpcInvokeArgs<C extends IpcInvokeChannel> = IpcChannels[C]['args'];
export type IpcInvokeResult<C extends IpcInvokeChannel> = IpcChannels[C]['result'];

export const IPC_CHANNELS = [
  'app:getFlavor',
  'app:ping',
  'settings:get',
  'storage:health',
] as const satisfies readonly IpcInvokeChannel[];

export function isIpcChannel(value: string): value is IpcInvokeChannel {
  return (IPC_CHANNELS as readonly string[]).includes(value);
}

export function createPingResponse(from: 'main' | 'preload' | 'renderer'): {
  ok: true;
  from: typeof from;
} {
  return { ok: true, from };
}
