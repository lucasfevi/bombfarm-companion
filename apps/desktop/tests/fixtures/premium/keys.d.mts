export interface TestKeypair {
  readonly keyId: string;
  /** The raw 32-byte public key, base64url. */
  readonly x: string;
  /** The private seed, base64url. */
  readonly d: string;
}

export const TEST_BUNDLE_KEYPAIR: TestKeypair;
export const TEST_LEASE_KEYPAIR: TestKeypair;
