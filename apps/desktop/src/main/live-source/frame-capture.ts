/**
 * A dev-only raw capture of the live frame stream, so a replayable byte-stream fixture (the shape
 * `fixtures/generate-replay-stream.ts` synthesises) can instead be produced from a real session.
 * Every push is written as one `capture-format.ts` record, carrying the {@link Ctx} the hook read
 * it on so replay can demultiplex it back onto the right connection instead of concatenating
 * every TLS connection's bytes into one undecodable stream. Payload bytes inside a record are
 * never re-encoded — the resulting file replays through the same decoding path that read it live.
 *
 * Three independent gates decide whether anything is ever written: the build must be unpackaged,
 * the app flavor must be `dev`, and capture must be explicitly enabled. No gate alone is trusted —
 * and the packaging gate is not redundant with the flavor one, because `package:dev` produces a
 * packaged artifact stamped with the `dev` flavor, so an installed build can satisfy the flavor
 * check. `isPackaged` is a required dep rather than something read here, so the caller has to pass
 * Electron's real answer and no environment can talk a packaged build into capturing.
 */

import type { AppFlavor } from '@bombfarm/contracts';
import { encodeCaptureHeader, encodeCaptureRecord } from './capture-format.js';
export type { LogPort } from './log-port.js';
import type { LogPort } from './log-port.js';
import type { Ctx } from './tls-stream.js';

export interface FrameCaptureAppendPort {
  append(bytes: Uint8Array): void;
  close(): void;
}

export interface FrameCapture {
  push(ctx: Ctx, bytes: Uint8Array): void;
  close(): void;
}

export interface FrameCaptureDeps {
  /** Required, with no default: the factory must not be constructible without an answer, because
   *  this is where the decision is made. */
  readonly isPackaged: boolean;
  readonly flavor: AppFlavor;
  readonly enabled: boolean;
  readonly maxBytes: number;
  readonly appendPort: FrameCaptureAppendPort;
  readonly log: LogPort;
}

const CAPTURE_ENV_VAR = 'BFC_LIVE_FRAME_CAPTURE';

export function readFrameCaptureEnabledFromEnv(env: Readonly<Record<string, string | undefined>>): boolean {
  return env[CAPTURE_ENV_VAR] === '1';
}

const NOOP_CAPTURE: FrameCapture = { push: () => undefined, close: () => undefined };

const HEADER = encodeCaptureHeader();

export function createFrameCapture(deps: FrameCaptureDeps): FrameCapture {
  // Packaging is checked before flavor so the log names which gate refused, rather than reporting
  // a packaged dev build as being outside dev. Like the flavor refusal below, it only speaks when
  // the enabling variable is already set — nothing here advertises the mode to anyone who did not
  // ask for it.
  if (deps.isPackaged) {
    if (deps.enabled) {
      deps.log.warn({ scope: 'frame-capture', event: 'unavailable_in_packaged_build', flavor: deps.flavor });
    }
    return NOOP_CAPTURE;
  }

  if (deps.flavor !== 'dev') {
    if (deps.enabled) {
      deps.log.warn({ scope: 'frame-capture', event: 'unavailable_outside_dev', flavor: deps.flavor });
    }
    return NOOP_CAPTURE;
  }

  if (!deps.enabled) return NOOP_CAPTURE;

  deps.log.info({ scope: 'frame-capture', event: 'started', maxBytes: deps.maxBytes });

  let totalBytes = 0;
  let stopped = false;
  let reported = false;
  let headerWritten = false;

  function report(event: string, extra: Record<string, unknown> = {}): void {
    if (reported) return;
    reported = true;
    deps.log.warn({ scope: 'frame-capture', event, totalBytes, ...extra });
  }

  /** Returns whether the write went through. On failure this both flips `stopped` and reports —
   *  the one path every append (header or record) shares, so a header write that fails behaves
   *  exactly like a record write that fails. */
  function tryAppend(bytes: Uint8Array): boolean {
    try {
      deps.appendPort.append(bytes);
      totalBytes += bytes.length;
      return true;
    } catch (error) {
      stopped = true;
      report('append_failed', { error: String(error) });
      return false;
    }
  }

  return {
    push(ctx: Ctx, bytes: Uint8Array): void {
      if (stopped) return;

      const record = encodeCaptureRecord(ctx, bytes);
      const pendingHeaderBytes = headerWritten ? 0 : HEADER.length;
      if (totalBytes + pendingHeaderBytes + record.length > deps.maxBytes) {
        stopped = true;
        report('byte_cap_reached');
        return;
      }

      if (!headerWritten) {
        if (!tryAppend(HEADER)) return;
        headerWritten = true;
      }

      tryAppend(record);
    },
    close(): void {
      deps.appendPort.close();
    },
  };
}
