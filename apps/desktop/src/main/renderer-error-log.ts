import { RENDERER_ERROR_KEYS, type RendererErrorRecord } from '@bombfarm/contracts';
import type { SenderWindow } from './ipc-sender-policy.js';

/** A React component stack runs to a few KB and a JS stack to one or two; message and the two
 *  labels are short by nature. Past these a field is a page filling the disk, not a crash. */
export const RENDERER_ERROR_FIELD_CAPS: Readonly<Record<keyof RendererErrorRecord, number>> = {
  event: 64,
  screen: 64,
  message: 2048,
  stack: 8192,
  componentStack: 8192,
};

/** Five at once covers a screen that crashes, is retried and crashes again; after that one record
 *  every ten seconds, so a crash loop writes about six a minute. */
export const RENDERER_ERROR_BURST = 5;
export const RENDERER_ERROR_REFILL_MS = 10_000;
export const RENDERER_ERROR_SUPPRESSION_REPORT_MS = 60_000;

const HIGH_SURROGATE_END = /[\uD800-\uDBFF]$/;
const TAB = 0x09;
const LINE_FEED = 0x0a;
const SPACE = 0x20;
const DELETE = 0x7f;

function withoutControlCharacters(text: string): string {
  let kept = '';
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code === TAB || code === LINE_FEED || (code >= SPACE && code !== DELETE)) kept += text.charAt(index);
  }
  return kept;
}

function limited(value: unknown, cap: number): string {
  if (typeof value !== 'string') return '';
  if (value.length <= cap) return withoutControlCharacters(value);
  const marker = `…[truncated, was ${String(value.length)} chars]`;
  const head = value.slice(0, cap - marker.length).replace(HIGH_SURROGATE_END, '');
  return withoutControlCharacters(head) + marker;
}

function isPlainRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw);
}

/** The record a window may log: the five contract keys, each a capped string with control
 *  characters (an ANSI escape would otherwise reach whoever reads the file in a terminal) removed.
 *  A missing or non-string value becomes empty, and every other key is dropped. `null` only for
 *  something that is not an object at all. */
export function parseRendererErrorRecord(raw: unknown): RendererErrorRecord | null {
  if (!isPlainRecord(raw)) return null;
  const read = (key: keyof RendererErrorRecord): string =>
    limited(Object.prototype.hasOwnProperty.call(raw, key) ? raw[key] : undefined, RENDERER_ERROR_FIELD_CAPS[key]);
  const record = { event: '', screen: '', message: '', stack: '', componentStack: '' };
  for (const key of RENDERER_ERROR_KEYS) record[key] = read(key);
  return record;
}

/** `scope` is written first and from here, so no field of a parsed record can replace it. */
export function rendererErrorLogRecord(record: RendererErrorRecord): Record<string, unknown> {
  return { scope: 'renderer', ...record };
}

export interface RendererErrorGateDeps {
  now: () => number;
  warn: (record: Record<string, unknown>) => void;
  /** Runs `callback` once after `delayMs`. The default timer is unref'd so a pending report never
   *  holds the process open. */
  schedule?: (callback: () => void, delayMs: number) => void;
}

export interface RendererErrorGate {
  /** `false` when this window has used its allowance: the call is to be dropped. */
  admit(window: SenderWindow): boolean;
}

interface Bucket {
  tokens: number;
  refilledAt: number;
  suppressed: number;
  reportPending: boolean;
}

function unrefTimer(callback: () => void, delayMs: number): void {
  setTimeout(callback, delayMs).unref();
}

/** A token bucket per window. What it drops is counted and reported once, a minute after the first
 *  drop, as a single line — so a crash loop leaves a bounded trail that says it was bounded. */
export function createRendererErrorGate(deps: RendererErrorGateDeps): RendererErrorGate {
  const schedule = deps.schedule ?? unrefTimer;
  const buckets = new Map<SenderWindow, Bucket>();

  function bucketFor(window: SenderWindow): Bucket {
    let bucket = buckets.get(window);
    if (bucket === undefined) {
      bucket = { tokens: RENDERER_ERROR_BURST, refilledAt: deps.now(), suppressed: 0, reportPending: false };
      buckets.set(window, bucket);
    }
    return bucket;
  }

  function reportSuppressed(window: SenderWindow, bucket: Bucket): void {
    deps.warn({
      scope: 'renderer',
      event: 'error_log.suppressed',
      window,
      suppressed: bucket.suppressed,
    });
    bucket.suppressed = 0;
    bucket.reportPending = false;
  }

  return {
    admit: (window) => {
      const bucket = bucketFor(window);
      const now = deps.now();
      const refill = Math.max(0, now - bucket.refilledAt) / RENDERER_ERROR_REFILL_MS;
      bucket.tokens = Math.min(RENDERER_ERROR_BURST, bucket.tokens + refill);
      bucket.refilledAt = now;
      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return true;
      }
      bucket.suppressed += 1;
      if (!bucket.reportPending) {
        bucket.reportPending = true;
        schedule(() => {
          reportSuppressed(window, bucket);
        }, RENDERER_ERROR_SUPPRESSION_REPORT_MS);
      }
      return false;
    },
  };
}
