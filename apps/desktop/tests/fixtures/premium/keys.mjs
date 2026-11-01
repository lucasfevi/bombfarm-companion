/**
 * Test-only Ed25519 keypairs for the Premium host: one signs the fixture bundle's manifest, one
 * signs Leases for the stub server. Both halves are committed on purpose — these keys protect
 * nothing. The build trusts their public halves only in the dev flavour, and the packaging gate
 * fails a beta or prod package that contains them.
 *
 * `x` is the raw 32-byte public key and `d` the private seed, both base64url (JWK members). A
 * key id is the first 8 characters of base64url(sha256(raw public key)).
 */

export const TEST_BUNDLE_KEYPAIR = Object.freeze({
  keyId: '25wFMu0B',
  x: '2Vdp6WURTEhR0e27dvXROYUcDGQkksUQLa_W-LJ88N8',
  d: 'aOEsJxxAk8jfzw6h4kcVrYK7amV3Xl81GBNXc2hTDc8',
});

export const TEST_LEASE_KEYPAIR = Object.freeze({
  keyId: 'gQeWKslZ',
  x: '_roXRDhHYO45U6ZROFd7wPoqq1VFY7hvhbykOyneXLs',
  d: 'qB8luWC4be9_qVfuo5RVfxproIhWscHXJ0zcx_6et2A',
});
