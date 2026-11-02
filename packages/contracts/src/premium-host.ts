/**
 * What the Premium host offers a bundle and what crosses IPC about it: the plugin API version, the
 * manifest a bundle ships with, the shared modules a bundle may import from the app, the capability
 * calls a worker may make, and the host view the Premium tab reads. Nothing here is a secret; the
 * bundle public keys are public by nature.
 */

import type { AppFlavor } from './flavors.js';
import type { AppLocale } from './locale.js';

/** The host API version a bundle is built against and a renewal reports to the server. */
export const PLUGIN_API_VERSION = '1.1.0';

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

/** The modules a bundle's UI imports from the app instead of bundling its own copy. */
export const PREMIUM_SHARED_MODULES = Object.freeze([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react/compiler-runtime',
  '@bombfarm/ui',
] as const);

/** What a worker may ask the host for. */
export const PREMIUM_CAPABILITIES = Object.freeze(['premium.status', 'store', 'log', 'notify'] as const);

export type PremiumCapability = (typeof PREMIUM_CAPABILITIES)[number];

export type CapabilityCall = { id: number; capability: string; args: unknown };

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
        | 'unavailable';
    };

/** Why the host paused the bundle: another account is playing, or the licence is unconfirmed. */
export type PremiumPauseReason = 'other_account' | 'unconfirmed';

export type HostToWorker =
  | { t: 'init'; sequence: number; version: string; granted: readonly string[] }
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
}

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
