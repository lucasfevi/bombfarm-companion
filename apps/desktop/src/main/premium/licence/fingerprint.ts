import { createHmac } from 'node:crypto';

/**
 * `HMAC-SHA256(fingerprintSalt, MachineGuid)` as lowercase hex. The salt is the
 * base64url text the server returns and keys the HMAC as its 32 decoded bytes. The machine id is
 * used here and goes no further.
 */
export function fingerprint(saltBase64Url: string, machineGuid: string): string {
  return createHmac('sha256', Buffer.from(saltBase64Url, 'base64url')).update(machineGuid, 'utf8').digest('hex');
}
