import { createHash, type KeyObject, sign } from 'node:crypto';
import type { SignedMethod } from '../premium-transport.js';

export interface DeviceHeaderInput {
  readonly keyId: string;
  readonly privateKey: KeyObject;
  readonly method: SignedMethod;
  readonly path: string;
  /** The exact string that is sent as the request body. */
  readonly body: string;
  readonly nowMs: number;
  /** Server time minus local time from the last response of any route; 0 before the first. */
  readonly offsetMs: number;
}

/** The `BFC-Device` value: `<keyId>.<unix seconds>.<base64url Ed25519 signature>`. */
export function deviceHeader(input: DeviceHeaderInput): string {
  const seconds = String(Math.floor((input.nowMs + input.offsetMs) / 1000));
  const digest = createHash('sha256').update(input.body, 'utf8').digest('hex');
  const message = `${input.method}\n${input.path}\n${seconds}\n${digest}`;
  const signature = sign(null, Buffer.from(message, 'utf8'), input.privateKey).toString('base64url');
  return `${input.keyId}.${seconds}.${signature}`;
}
