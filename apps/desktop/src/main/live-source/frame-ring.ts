/**
 * A bounded in-memory ring of recently seen raw frame payloads, so that when a frame fails to
 * parse the question "what did the stream look like just before this" is answerable. Retention
 * is bounded by both frame count and total byte size — a count-only cap lets one unexpectedly
 * large frame (exactly the kind that shows up right before a parse failure) balloon memory use.
 *
 * Scrubbing runs at {@link FrameRing.dump}, not at {@link FrameRing.push}: at the arrival rate
 * this ring is fed, almost every pushed frame is later evicted unread, so scrubbing on push would
 * pay the cost on data that is thrown away. Paying it once, at dump time, is strictly cheaper.
 */

import { isPlainObject } from '@bombfarm/game-api';
import { isSensitiveKey } from '../boundary-log/redaction.js';

export type { LogPort } from './log-port.js';
import type { LogPort } from './log-port.js';

export const PERSONAL_FIELDS = ['account_id', 'player_name'] as const;

const REDACTION_PLACEHOLDER = '[redacted]';
const UNREADABLE_PLACEHOLDER_KIND = 'unreadable';
const DEFAULT_DUMP_RATE_LIMIT_MS = 5_000;

const NOOP_LOG_PORT: LogPort = { info: () => undefined, warn: () => undefined };

export interface FrameDumpWritePort {
  write(destination: string, contents: string): void;
}

export interface FrameRingDeps {
  readonly maxFrames: number;
  readonly maxBytes: number;
  readonly dumpPath: string;
  readonly writePort: FrameDumpWritePort;
  readonly now?: () => number;
  readonly dumpRateLimitMs?: number;
  readonly log?: LogPort;
}

type DumpedFrame =
  | { readonly kind: 'json'; readonly byteLength: number; readonly payload: unknown }
  | { readonly kind: 'text'; readonly byteLength: number; readonly text: string }
  | { readonly kind: typeof UNREADABLE_PLACEHOLDER_KIND; readonly byteLength: number };

export interface FrameRingDump {
  readonly frameCount: number;
  readonly frames: readonly DumpedFrame[];
}

export type FrameDumpReason = 'parse-failure' | 'manual';

export type FrameDumpOutcome =
  | { readonly written: true; readonly path: string }
  | { readonly written: false; readonly reason: 'rate-limited' | 'write-failed' };

type CredentialRedactor = (text: string) => string;

function redactSecrets(text: string, secrets: ReadonlySet<string>, credentialRedactor: CredentialRedactor | null): string {
  let result = text;
  for (const secret of secrets) {
    if (secret.length === 0) continue;
    result = result.split(secret).join(REDACTION_PLACEHOLDER);
  }
  return credentialRedactor ? credentialRedactor(result) : result;
}

/** One traversal applying every scrub rule per node, rather than three passes over the same tree:
 *  a personal field ({@link PERSONAL_FIELDS}) is removed, a sensitive-named key
 *  ({@link isSensitiveKey}, reused from the boundary log rather than a second list) is blanked to
 *  the redacted marker, and any other string is checked for a secret substring. Removal wins when
 *  a key is both a personal field and a sensitive-named key, since the field is dropped before the
 *  sensitive-key check ever runs. */
function scrubNode(value: unknown, secrets: ReadonlySet<string>, credentialRedactor: CredentialRedactor | null): unknown {
  if (Array.isArray(value)) return value.map((item) => scrubNode(item, secrets, credentialRedactor));
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if ((PERSONAL_FIELDS as readonly string[]).includes(key)) continue;
      out[key] = isSensitiveKey(key)
        ? redactSecrets(REDACTION_PLACEHOLDER, secrets, credentialRedactor)
        : scrubNode(v, secrets, credentialRedactor);
    }
    return out;
  }
  if (typeof value === 'string') return redactSecrets(value, secrets, credentialRedactor);
  return value;
}

function scrubFrame(frame: Buffer, secrets: ReadonlySet<string>, credentialRedactor: CredentialRedactor | null): DumpedFrame {
  const text = frame.toString('utf8');
  const isReadableText = Buffer.from(text, 'utf8').equals(frame);
  if (!isReadableText) {
    return { kind: UNREADABLE_PLACEHOLDER_KIND, byteLength: frame.length };
  }

  try {
    const parsed: unknown = JSON.parse(text);
    const payload = scrubNode(parsed, secrets, credentialRedactor);
    return { kind: 'json', byteLength: frame.length, payload };
  } catch {
    return { kind: 'text', byteLength: frame.length, text: redactSecrets(text, secrets, credentialRedactor) };
  }
}

export class FrameRing {
  readonly #maxFrames: number;
  readonly #maxBytes: number;
  readonly #dumpPath: string;
  readonly #writePort: FrameDumpWritePort;
  readonly #now: () => number;
  readonly #dumpRateLimitMs: number;
  readonly #log: LogPort;

  #frames: Buffer[] = [];
  #totalBytes = 0;
  #secrets = new Set<string>();
  #credentialRedactor: CredentialRedactor | null = null;
  #lastDumpAt: number | undefined;

  constructor(deps: FrameRingDeps) {
    this.#maxFrames = deps.maxFrames;
    this.#maxBytes = deps.maxBytes;
    this.#dumpPath = deps.dumpPath;
    this.#writePort = deps.writePort;
    this.#now = deps.now ?? Date.now;
    this.#dumpRateLimitMs = deps.dumpRateLimitMs ?? DEFAULT_DUMP_RATE_LIMIT_MS;
    this.#log = deps.log ?? NOOP_LOG_PORT;
  }

  size(): number {
    return this.#frames.length;
  }

  registerSecret(secret: string): void {
    this.#secrets.add(secret);
  }

  /** A single slot, not a growing list: there is only ever one session token live at a time, and
   *  a later call replaces the earlier one rather than accumulating unboundedly. */
  setCredentialRedactor(redact: CredentialRedactor | null): void {
    this.#credentialRedactor = redact;
  }

  /** A frame larger than the byte cap on its own can never coexist with any other frame under
   *  that cap, so evicting to make room for it would never terminate at a state satisfying both
   *  bounds. Dropping it instead keeps the ring strictly bounded by construction and leaves
   *  whatever it already held untouched. */
  push(bytes: Uint8Array): void {
    const frame = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    if (frame.length > this.#maxBytes) return;

    this.#frames.push(frame);
    this.#totalBytes += frame.length;
    this.#evict();
  }

  #evict(): void {
    while (this.#frames.length > this.#maxFrames || this.#totalBytes > this.#maxBytes) {
      const removed = this.#frames.shift();
      if (!removed) break;
      this.#totalBytes -= removed.length;
    }
  }

  dump(): string {
    const frames = this.#frames.map((frame) => scrubFrame(frame, this.#secrets, this.#credentialRedactor));
    const dump: FrameRingDump = { frameCount: frames.length, frames };
    return JSON.stringify(dump);
  }

  dumpToDisk(reason: FrameDumpReason): FrameDumpOutcome {
    const now = this.#now();
    if (this.#lastDumpAt !== undefined && now - this.#lastDumpAt < this.#dumpRateLimitMs) {
      return { written: false, reason: 'rate-limited' };
    }
    this.#lastDumpAt = now;

    try {
      this.#writePort.write(this.#dumpPath, this.dump());
      return { written: true, path: this.#dumpPath };
    } catch (error) {
      this.#log.warn({ scope: 'frame-ring', event: 'dump.write_failed', reason, error: String(error) });
      return { written: false, reason: 'write-failed' };
    }
  }
}
