/**
 * What the Premium licence feature shares between the main process and the renderer: the two
 * trusted lease public keys, the plugin API version a renewal reports, the support link, and the
 * view that crosses IPC. Nothing here is a secret; the view carries no key, id or Lease bytes.
 */

export interface LeasePublicKey {
  readonly keyId: string;
  /** The raw 32-byte Ed25519 public key, base64url. */
  readonly x: string;
}

/**
 * The only keys a Lease may be signed with: the current one and a spare kept offline, so the signing
 * key can be rotated without an app release. A key id is the first 8 characters of
 * base64url(sha256(raw public key)).
 */
export const LEASE_PUBLIC_KEYS: readonly LeasePublicKey[] = [
  { keyId: 'lCwiDkHw', x: 'jEKIJQy7hPRJ2_eBmrbPRb4uf-By31zFjCbodBu6578' },
  { keyId: 'zkPxZDIt', x: 'RmEnI-p1uw7dqT7D9DP79Z_7s4VWjIHSschX1pseCio' },
];

/** The host API version a renewal reports to the server. */
export const PLUGIN_API_VERSION = '1.0.0';

/** Where "contact support" points. Plain text while null; a link once a channel exists. */
export const SUPPORT_URL: string | null = null;

export const LICENCE_STATES = [
  'signed_out',
  'inactive',
  'holds',
  'elsewhere',
  'unconfirmed',
  'mismatch',
  'moved',
  'released',
  'ended',
  'move_limit',
] as const;

export type LicenceState = (typeof LICENCE_STATES)[number];

/** Why a state is `unconfirmed`, as a fixed word. */
export const LICENCE_REASONS = [
  'no_secure_storage',
  'no_fingerprint',
  'device_signature',
  'lease_invalid',
  'network',
] as const;

export type LicenceReason = (typeof LICENCE_REASONS)[number];

/**
 * The only licence facts that leave the main process. `holderName` is the computer name another PC
 * reported; the dates are the server's Move dates.
 */
export interface PremiumLicenceView {
  readonly state: LicenceState;
  readonly reason?: LicenceReason;
  readonly holderName?: string;
  readonly lastMoveAt?: string;
  readonly nextMoveAt?: string;
  readonly moveInFlight: boolean;
  readonly moveFailed: boolean;
  /** True once the premium code is gone from this PC; the full "it's been removed" line shows then. */
  readonly removalDone: boolean;
}
