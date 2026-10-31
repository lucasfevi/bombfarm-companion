export interface SignedFixture {
  /** The exact bytes that were signed (compact JSON, never re-serialised). */
  manifestBytes: Uint8Array;
  /** The 64-byte Ed25519 signature over `manifestBytes`. */
  sig: Uint8Array;
  /** The bundle files by manifest path. */
  files: Map<string, Uint8Array>;
}

export interface FixtureOptions {
  sequence?: number;
  /** ISO timestamps; default now and now + 180 days. */
  createdAt?: string;
  expiresAt?: string;
  hostApi?: string;
  minAppVersion?: string;
  flavors?: readonly string[];
  capabilities?: readonly string[];
  version?: string;
  /** Overrides the key id written into the manifest; the signature still uses the test key. */
  keyId?: string;
  /** Changes the manifest object (and the file map) before it is serialised and signed. */
  edit?: (draft: { manifest: Record<string, unknown>; files: Map<string, Uint8Array> }) => void;
  /** Alters the result after signing, so a signed manifest can meet bytes it does not describe. */
  mutate?: (signed: SignedFixture) => SignedFixture | void;
}

export const FIXTURE_FILES: readonly string[];

/** Builds the fixture bundle and signs its manifest with the test bundle key at call time. */
export function signFixture(options?: FixtureOptions): SignedFixture;
