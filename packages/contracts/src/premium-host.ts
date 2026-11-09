/**
 * What the Premium host offers a bundle and what crosses IPC about it: the plugin API version, the
 * manifest a bundle ships with, the shared modules a bundle may import from the app, the capability
 * calls a worker may make, and the host view the Premium tab reads. Nothing here is a secret; the
 * bundle public keys are public by nature.
 */

import type { AppFlavor } from './flavors.js';
import type { AppLocale } from './locale.js';

/** The host API version a bundle is built against and a renewal reports to the server. */
export const PLUGIN_API_VERSION = '1.3.0';

export type PremiumBundleRole = 'worker' | 'renderer' | 'style';

export interface PremiumManifestFile {
  readonly path: string;
  readonly role: PremiumBundleRole;
  readonly size: number;
  readonly sha256: string;
}

export interface PremiumManifest {
  readonly schema: 1;
  readonly keyId: string;
  readonly bundle: 'premium';
  readonly version: string;
  readonly sequence: number;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly hostApi: string;
  readonly minAppVersion: string;
  readonly flavors: readonly AppFlavor[];
  readonly capabilities: readonly string[];
  readonly files: readonly PremiumManifestFile[];
}

/**
 * The modules a bundle's UI imports from the app instead of bundling its own copy. Sharing the app's
 * game art means a bundle draws an item, chest or key with the very component the app's screens use,
 * hover card included, instead of a look-alike that drifts.
 */
export const PREMIUM_SHARED_MODULES = Object.freeze([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react/compiler-runtime',
  '@bombfarm/ui',
  '@bombfarm/game-art',
] as const);

/** What a worker may ask the host for. */
export const PREMIUM_CAPABILITIES = Object.freeze([
  'premium.status',
  'store',
  'log',
  'notify',
  'db',
  'raw.tap',
  'raw.battleLog',
  'premium.worker',
] as const);

/** Where a bundle's screen may mount: the Premium tab and a section of the Live page. */
export const PREMIUM_SLOTS = Object.freeze(['premium.tab', 'live.section'] as const);

export type PremiumSlot = (typeof PREMIUM_SLOTS)[number];

export type PremiumCapability = (typeof PREMIUM_CAPABILITIES)[number];

export type CapabilityCall = { id: number; capability: string; args: unknown; slot?: PremiumSlot };

export type CapabilityReply =
  | { id: number; ok: true; value: unknown }
  | {
      id: number;
      ok: false;
      error:
        | 'not_granted'
        | 'rate_limited'
        | 'paused'
        | 'stopped'
        | 'bad_call'
        | 'bad_args'
        | 'too_large'
        | 'unavailable'
        | 'timeout'
        | 'failed';
      /** Set only by `db` and `premium.worker`: a category, never engine text, SQL or parameters. */
      reason?: DbRefusalReason | PremiumWorkerRefusalReason;
    };

/** Why the host paused the bundle: another account is playing, or the licence is unconfirmed. */
export type PremiumPauseReason = 'other_account' | 'unconfirmed';

/** The `db` call envelope. Parameters are positional: `$1` … `$n`. */
export type DbParam = string | number | boolean | null;
export type DbArgs =
  | { op: 'exec'; sql: string; params?: readonly DbParam[] }
  | { op: 'query'; sql: string; params?: readonly DbParam[] }
  | { op: 'batch'; sql: string; rows: readonly (readonly DbParam[])[] }
  | { op: 'tx'; steps: readonly { sql: string; params?: readonly DbParam[] }[] }
  | { op: 'size' }
  | { op: 'status' };

/** BIGINT, HUGEINT, DECIMAL, dates and times arrive as strings. */
export type DbValue = string | number | boolean | null;

export type DbUnavailableReason =
  | 'engine_unavailable'
  | 'db_unreadable'
  | 'no_secure_storage'
  | 'clearing'
  | 'no_subject';

export type DbRefusalReason =
  | DbUnavailableReason // error 'unavailable'
  | 'disk_full'
  | 'constraint'
  | 'catalog'
  | 'conversion'
  | 'other' // error 'failed'
  | 'shape'
  | 'statement_count'
  | 'statement_type'
  | 'bind' // error 'bad_args'
  | 'rows'
  | 'bytes'
  | 'params'; // error 'too_large'

/** The reasons `premium.worker` refuses with: `unavailable` (no handler), `failed` (the handler threw), `too_large`. */
export type PremiumWorkerRefusalReason = 'no_handler' | Extract<DbRefusalReason, 'other' | 'bytes'>;

export type DbAnswer = {
  exec: { changes: number };
  query: { columns: readonly string[]; rows: readonly (readonly DbValue[])[] };
  batch: { changes: number };
  tx: { changes: readonly number[] };
  size: { bytes: number };
  status: { state: 'ready' } | { state: 'unavailable'; reason: DbUnavailableReason };
};

/** The configuration the tracking database opens with. */
export const TRACKING_DB_OPEN_CONFIG = Object.freeze({
  autoinstall_known_extensions: 'false',
  autoload_known_extensions: 'false',
  allow_community_extensions: 'false',
  allow_unsigned_extensions: 'false',
  threads: '2',
  memory_limit: '512MB',
  temp_directory: '',
} as const);

/** Applied in this order after the encryption key is attached. */
export const TRACKING_DB_LOCK = Object.freeze([
  ['enable_external_access', 'false'],
  ['lock_configuration', 'true'],
] as const);

export const TRACKING_DB_STATEMENTS = Object.freeze({
  worker: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'MERGE_INTO'],
  ui: ['SELECT'],
  batch: ['INSERT', 'UPDATE', 'DELETE', 'MERGE_INTO'],
  tx: ['INSERT', 'UPDATE', 'DELETE', 'MERGE_INTO', 'CREATE', 'ALTER', 'DROP'],
  refusedCreateKinds: ['SECRET'],
} as const);

export const TRACKING_DB_LIMITS = Object.freeze({
  sqlBytes: 64 * 1024,
  params: 256,
  batchRows: 5_000,
  txSteps: 256,
  writeParamBytes: 4 * 1024 * 1024, // batch or tx, serialised params
  resultRows: 10_000,
  resultBytes: 8 * 1024 * 1024,
  statementMs: 10_000,
  callsPerMinutePerHalf: 600,
} as const);

/** One item of the raw game feed: a frame as the game sent it, or a parsed JSON response body. */
export type RawTapItem =
  | { kind: 'frame'; seq: number; atMs: number; accountKey: string; wire: Record<string, unknown> }
  | { kind: 'body'; seq: number; atMs: number; accountKey: string; body: unknown };

export type RawBattleLogItem = {
  seq: number;
  atMs: number;
  accountKey: string;
  /** `acc_${accountKey}`. */
  section: string;
  text: string;
  mtimeMs: number;
  gameLanguage: string | null;
  baseline: boolean;
};

export type RawGapItem = { feed: 'raw.tap' | 'raw.battleLog'; dropped: number; fromSeq: number };

export type DbClearedItem = { atMs: number };

/** The event names a worker may listen for. */
export type HostEventName = 'paused' | 'resumed' | 'raw.tap' | 'raw.battleLog' | 'raw.gap' | 'db.cleared';

/** A batch of feed items; the loader answers `{ t: 'ack', seq }` once every listener has run. */
export type HostEventsMessage =
  | { t: 'events'; seq: number; name: 'raw.tap'; items: readonly RawTapItem[] }
  | { t: 'events'; seq: number; name: 'raw.battleLog'; items: readonly RawBattleLogItem[] }
  | { t: 'events'; seq: number; name: 'raw.gap'; items: readonly RawGapItem[] }
  | { t: 'events'; seq: number; name: 'db.cleared'; items: readonly DbClearedItem[] };

/** The bundle's screen asking its own worker (`premium.worker`). */
export type HostUiMessage = { t: 'ui'; id: number; slot: PremiumSlot; msg: unknown };

export type WorkerAckMessage = { t: 'ack'; seq: number };
export type WorkerUiReply =
  | { t: 'uiReply'; id: number; ok: true; value: unknown }
  | { t: 'uiReply'; id: number; ok: false; reason?: 'no_handler' | 'other' };

export type HostToWorker =
  | { t: 'init'; sequence: number; version: string; granted: readonly string[] }
  | HostEventsMessage
  | HostUiMessage
  // SPEC_DEVIATION: `reason` is optional on the wire type.
  // Reason: callers that pause without a known reason (and the tests that pin their message) stay valid.
  | { t: 'paused'; reason?: PremiumPauseReason }
  | { t: 'resumed' }
  | CapabilityReply;

/** What `premium.status` answers: exactly these fields. */
export type PremiumStatusAnswer = {
  active: boolean;
  until: string | null;
  paused: boolean;
  pausedReason: PremiumPauseReason | null;
  audience: 'owner' | 'tester' | 'public';
};

/** The notifications a bundle may ask the host to show, in both locales. */
export const PREMIUM_NOTIFICATIONS = Object.freeze({
  'premium.test': {
    en: { title: 'Premium is working', body: 'This is a test notification from Premium.' },
    'pt-BR': { title: 'O Premium está funcionando', body: 'Esta é uma notificação de teste do Premium.' },
  },
} as const satisfies Record<string, Record<AppLocale, { title: string; body: string }>>);

/** What the Premium tab learns about the bundle: a phase and the two URLs to mount. */
export interface PremiumHostView {
  readonly phase: 'none' | 'updating' | 'running' | 'paused' | 'stopped';
  readonly uiUrl: string | null;
  readonly styleUrl: string | null;
  readonly localBuild: boolean;
  // SPEC_DEVIATION: optional, absent while the bundle is not paused.
  // Reason: views built without it (every earlier producer and test) stay valid.
  readonly paused?: { readonly reason: PremiumPauseReason } | null;
  /** The slots granted while the bundle runs. */
  readonly slots?: readonly PremiumSlot[];
}

/** What Settings learns about the tracking history on disk. */
export type TrackingHistoryView =
  | { state: 'none' }
  | { state: 'present'; bytes: number }
  | {
      state: 'engine_unavailable';
      bytes: number | null;
      reason: 'binding_missing' | 'extension_missing' | 'probe_failed';
    };

export interface BundlePublicKey {
  readonly keyId: string;
  /** The raw 32-byte Ed25519 public key, base64url. */
  readonly x: string;
}

/** The only keys a bundle manifest may be signed with: the current one and a spare. */
export const BUNDLE_PUBLIC_KEYS: readonly BundlePublicKey[] = [
  { keyId: 'oE-XEJfw', x: 'j4GLOm18vCUpNtWYu4nJPm3VHnqsTfF-ToplshJQIps' },
  { keyId: 'r5RkhZ1L', x: '1jhVnXUB6oogkbR_BhN5OuGb_VJlQneetGd4GBy5Tjg' },
];
