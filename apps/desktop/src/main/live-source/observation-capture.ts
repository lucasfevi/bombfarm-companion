/**
 * A dev-only record of every REST body and live frame the tap observes — including the bodies the
 * app refuses to identify and therefore discards, which is the whole reason this exists. The
 * output is newline-delimited JSON so a session survives a crash mid-write and is greppable
 * without tooling.
 */

import type { LiveCurrency } from '@bombfarm/contracts';
import { scrubJsonValue, type CredentialRedactor } from './scrub.js';

const CAPTURE_ENV_VAR = 'BFC_OBSERVATION_CAPTURE';

/**
 * `isPackaged` is a parameter rather than something read here, so the caller has to pass
 * Electron's real answer and a packaged build cannot be talked into recording live account
 * traffic by its environment — the same fail-closed shape `sessionCfgPath` uses for its token
 * override. Both parameters are required: there is no default a caller can omit into an unsafe
 * state.
 */
export function isObservationCaptureEnabled(
  env: Readonly<Record<string, string | undefined>>,
  isPackaged: boolean,
): boolean {
  return !isPackaged && env[CAPTURE_ENV_VAR] === '1';
}

/** Whether the value-level credential redactor was installed when a line was written. It is armed
 *  from the first successful session-token read, which is later than construction — so a reader
 *  can tell exactly which lines predate value-level scrubbing rather than having to assume. */
export type RedactionLevel = 'armed' | 'key-name-only';

export interface ObservationEnvelope {
  /** Monotonic, assigned at append. Authoritative for ordering — the timestamp is not, because
   *  two observations can share a millisecond. */
  readonly seq: number;
  readonly at: string;
  /** Most recent live-frame context, or an explicit null when no frame has arrived — never an
   *  omitted key, so "no frame yet" is distinguishable from "phase was zero". */
  readonly phase: number | null;
  readonly wave: number | null;
  readonly redaction: RedactionLevel;
}

/** The first three mirror `identifyObservedBody`'s verdicts one for one. `parse_failed` is this
 *  module's own fourth case: a body that is not JSON never reaches the identifier at all, and
 *  "we saw something we could not read" is itself a finding rather than a reason to drop it. */
export type ObservationBodyVerdict =
  | { readonly kind: 'identified'; readonly section: string }
  | { readonly kind: 'unidentified' }
  | { readonly kind: 'ambiguous'; readonly sections: readonly string[] }
  | { readonly kind: 'parse_failed' };

export type ObservationSessionEvent = 'started' | 'currency' | 'redactor_armed' | 'stopped' | 'append_failed';

export type ObservationRecord = ObservationEnvelope &
  (
    | {
        readonly kind: 'body';
        readonly byteLength: number;
        readonly verdict: ObservationBodyVerdict;
        /** Absent only for `parse_failed`, where there is nothing parseable to carry. */
        readonly body?: unknown;
      }
    | {
        readonly kind: 'frame';
        /** The wire object verbatim — decoded keys and keys the decoded tick never reads alike. */
        readonly wire: Record<string, unknown>;
      }
    | { readonly kind: 'mark'; readonly label: string }
    | {
        readonly kind: 'session';
        readonly event: ObservationSessionEvent;
        readonly detail?: Record<string, unknown>;
      }
  );

export interface ObservationAppendPort {
  /** Appends one whole line. Throws on failure; the caller latches and reports. */
  append(line: string): void;
  close(): void;
}

export interface ObservationSink {
  body(bytes: Buffer, atMs: number): void;
  frame(wire: Record<string, unknown>, atMs: number): void;
  currency(currency: LiveCurrency, atMs: number): void;
  mark(label: string, atMs: number): void;
}

/** The recorder never holds the raw token — the value half of redaction reaches it only as the
 *  single-slot closure `LiveSource` already owns, so there is no secret set to register. */
const NO_REGISTERED_SECRETS: ReadonlySet<string> = new Set<string>();

/**
 * The only path from a record to text, and the reason the token guarantee is structural rather
 * than a filter someone must remember to call: this module exports no `appendRaw` and no `write`,
 * so a new record kind cannot reach the file without passing through here.
 *
 * The round trip through `JSON.stringify` runs FIRST, before the scrub, so that every `toJSON` is
 * honoured — a `SessionToken` renders `[redacted]` from its own type rather than being walked as
 * a plain object and flattened to `{}` by the shared traversal, which would lose that layer
 * silently. What the scrub then sees is plain JSON, exactly its domain.
 */
export function encodeObservationLine(record: ObservationRecord, redact: CredentialRedactor | null): string {
  const asJson: unknown = JSON.parse(JSON.stringify(record));
  return `${JSON.stringify(scrubJsonValue(asJson, NO_REGISTERED_SECRETS, redact))}\n`;
}
