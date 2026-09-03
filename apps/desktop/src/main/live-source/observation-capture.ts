/**
 * A dev-only record of every REST body and live frame the tap observes — including the bodies the
 * app refuses to identify and therefore discards, which is the whole reason this exists. The
 * output is newline-delimited JSON so a session survives a crash mid-write and is greppable
 * without tooling.
 */

import type { LiveCurrency } from '@bombfarm/contracts';
import {
  identifyObservedBody,
  liveFrameWireKey as wireKey,
  type ObservedBodyIdentification,
} from '@bombfarm/game-api';
import type { LogPort } from './log-port.js';
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

/** A record without its envelope: the one write path stamps `seq`, `at`, `phase`, `wave` and the
 *  redaction level itself, so no caller can supply — or forget — them. */
export type ObservationRecordBody =
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
    };

export type ObservationRecord = ObservationEnvelope & ObservationRecordBody;

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

export interface ObservationCapture extends ObservationSink {
  setCredentialRedactor(redact: CredentialRedactor | null): void;
  close(): void;
}

export interface ObservationCaptureDeps {
  readonly enabled: boolean;
  readonly isPackaged: boolean;
  readonly destination: string;
  readonly appendPort: ObservationAppendPort;
  readonly log: LogPort;
  readonly identify?: (body: unknown) => ObservedBodyIdentification;
  readonly now?: () => number;
}

const NOOP_OBSERVATION_CAPTURE: ObservationCapture = {
  body: () => undefined,
  frame: () => undefined,
  currency: () => undefined,
  mark: () => undefined,
  setCredentialRedactor: () => undefined,
  close: () => undefined,
};

/** Lazily on append rather than on a timer, so there is no handle to leak on teardown — the same
 *  timerless discipline the raw frame capture keeps. */
const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * The recorder. Its two gates are independent of the caller's own check by design: a single gate
 * is one edit away from writing live account traffic out of a packaged build, so `index.ts` asks
 * {@link isObservationCaptureEnabled} and this constructor asks again.
 */
export function createObservationCapture(deps: ObservationCaptureDeps): ObservationCapture {
  if (deps.isPackaged || !deps.enabled) return NOOP_OBSERVATION_CAPTURE;

  const identify = deps.identify ?? identifyObservedBody;
  const now = deps.now ?? Date.now;

  let seq = 0;
  let phase: number | null = null;
  let wave: number | null = null;
  let redactor: CredentialRedactor | null = null;
  let stopped = false;
  let reported = false;
  let totalBytes = 0;
  let lastHeartbeatAt: number | null = null;

  function report(event: string, extra: Record<string, unknown> = {}): void {
    if (reported) return;
    reported = true;
    deps.log.warn({ scope: 'observation-capture', event, records: seq, totalBytes, ...extra });
  }

  function heartbeat(atMs: number): void {
    if (lastHeartbeatAt !== null && atMs - lastHeartbeatAt < HEARTBEAT_INTERVAL_MS) return;
    lastHeartbeatAt = atMs;
    deps.log.info({ scope: 'observation-capture', event: 'progress', records: seq, totalBytes });
  }

  /** The one write path. Every record kind reaches the file through here, and here alone calls
   *  {@link encodeObservationLine} — bypassing redaction would mean deleting this call, not
   *  forgetting one. */
  function write(atMs: number, body: ObservationRecordBody): void {
    if (stopped) return;
    seq += 1;
    const line = encodeObservationLine(
      {
        seq,
        at: new Date(atMs).toISOString(),
        phase,
        wave,
        redaction: redactor === null ? 'key-name-only' : 'armed',
        ...body,
      },
      redactor,
    );
    try {
      deps.appendPort.append(line);
      totalBytes += Buffer.byteLength(line, 'utf8');
    } catch (error) {
      stopped = true;
      report('append_failed', { error: String(error) });
      return;
    }
    heartbeat(atMs);
  }

  write(now(), { kind: 'session', event: 'started', detail: { destination: deps.destination } });

  return {
    body(bytes: Buffer, atMs: number): void {
      const byteLength = bytes.length;
      let parsed: unknown;
      try {
        parsed = JSON.parse(bytes.toString('utf8'));
      } catch {
        write(atMs, { kind: 'body', byteLength, verdict: { kind: 'parse_failed' } });
        return;
      }
      write(atMs, { kind: 'body', byteLength, verdict: identify(parsed), body: parsed });
    },

    frame(wire: Record<string, unknown>, atMs: number): void {
      const observedPhase = wire[wireKey('phase')];
      const observedWave = wire[wireKey('wave')];
      if (typeof observedPhase === 'number' && Number.isFinite(observedPhase)) phase = observedPhase;
      if (typeof observedWave === 'number' && Number.isFinite(observedWave)) wave = observedWave;
      write(atMs, { kind: 'frame', wire });
    },

    currency(currency: LiveCurrency, atMs: number): void {
      write(atMs, { kind: 'session', event: 'currency', detail: { currency } });
    },

    mark(label: string, atMs: number): void {
      write(atMs, { kind: 'mark', label });
    },

    setCredentialRedactor(redact: CredentialRedactor | null): void {
      const wasArmed = redactor !== null;
      redactor = redact;
      if (!wasArmed && redact !== null) write(now(), { kind: 'session', event: 'redactor_armed' });
    },

    close(): void {
      write(now(), { kind: 'session', event: 'stopped' });
      deps.appendPort.close();
    },
  };
}
