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

export type { LogPort } from './log-port.js';
import type { LogPort } from './log-port.js';
export { PERSONAL_FIELDS } from './scrub.js';
import { redactText, scrubJsonValue, type CredentialRedactor } from './scrub.js';

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

function scrubFrame(frame: Buffer, secrets: ReadonlySet<string>, credentialRedactor: CredentialRedactor | null): DumpedFrame {
  const text = frame.toString('utf8');
  const isReadableText = Buffer.from(text, 'utf8').equals(frame);
  if (!isReadableText) {
    return { kind: UNREADABLE_PLACEHOLDER_KIND, byteLength: frame.length };
  }

  try {
    const parsed: unknown = JSON.parse(text);
    const payload = scrubJsonValue(parsed, secrets, credentialRedactor);
    return { kind: 'json', byteLength: frame.length, payload };
  } catch {
    return { kind: 'text', byteLength: frame.length, text: redactText(text, secrets, credentialRedactor) };
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
