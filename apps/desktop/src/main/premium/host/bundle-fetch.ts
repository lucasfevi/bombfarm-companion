import type { PremiumManifest } from '@bombfarm/contracts';
import type { LogPort } from '../../storage/index.js';
import type { DeviceGetRequest, DeviceGetResult } from '../licence/licence-runner.js';
import { checkBundlePath } from './bundle-paths.js';
import {
  BUNDLE_MAX_FILES,
  MANIFEST_MAX_BYTES,
  verifyBundle,
  verifyManifest,
  type VerifiedBundle,
  type VerifyContext,
  type VerifyReason,
} from './bundle-verify.js';

/**
 * Downloads the bundle the server offers into memory: the manifest first, its signature checked
 * before anything else is asked for, then one request per listed file capped at the size the
 * manifest states. Nothing is written anywhere; the caller decides what to keep.
 */

/** The manifest answer carries the manifest as base64, so it can exceed the manifest's own cap. */
export const ANSWER_MAX_BYTES = Math.ceil((MANIFEST_MAX_BYTES * 4) / 3) + 32 * 1024;

export interface FetchLimits {
  readonly answerBytes: number;
  readonly fileBytes: number;
  readonly totalBytes: number;
}

export const DEFAULT_FETCH_LIMITS: FetchLimits = {
  answerBytes: ANSWER_MAX_BYTES,
  fileBytes: 4 * 1024 * 1024,
  totalBytes: 8 * 1024 * 1024,
};

export type FetchReason =
  | 'gate_closed'
  | 'unauthorized'
  | 'unreachable'
  | 'too_large'
  | 'aborted'
  | 'rate_limited'
  | 'bad_status'
  | 'bad_answer'
  | `none_${string}`;

export type FetchOutcome =
  | { readonly ok: true; readonly bundle: VerifiedBundle }
  | { readonly ok: false; readonly reason: FetchReason | VerifyReason; readonly sequence: number | null };

export interface BundleFetchDeps {
  readonly deviceGet: (req: DeviceGetRequest) => Promise<DeviceGetResult>;
  /** Read when the checks run, so the highest sequence and the floor are the current ones. */
  readonly context: () => VerifyContext;
  readonly limits?: FetchLimits;
  readonly signal: AbortSignal;
  readonly log: LogPort;
}

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;
const BASE64URL = /^[A-Za-z0-9_-]*$/;
const NONE_REASON = /^[a-z_]{1,32}$/;

interface Answer {
  readonly sequence: number;
  readonly manifestBytes: Uint8Array;
  readonly sig: Uint8Array;
}

function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(Buffer.from(bytes).toString('utf8'));
  } catch {
    return undefined;
  }
}

function parseAnswer(bytes: Uint8Array): Answer | null {
  const body = parseJson(bytes);
  if (typeof body !== 'object' || body === null) return null;
  const { sequence, manifest, signature } = body as Record<string, unknown>;
  if (!Number.isSafeInteger(sequence) || typeof manifest !== 'string' || typeof signature !== 'string') return null;
  if (!BASE64.test(manifest) || !BASE64URL.test(signature)) return null;
  return {
    sequence: sequence as number,
    manifestBytes: new Uint8Array(Buffer.from(manifest, 'base64')),
    sig: new Uint8Array(Buffer.from(signature, 'base64url')),
  };
}

/** `none_<reason>` for the resolver's own refusal, or null when the 404 names nothing usable. */
function noneReason(bytes: Uint8Array): FetchReason | null {
  const body = parseJson(bytes);
  const reason = typeof body === 'object' && body !== null ? (body as Record<string, unknown>)['reason'] : undefined;
  return typeof reason === 'string' && NONE_REASON.test(reason) ? `none_${reason}` : null;
}

function statusReason(result: Extract<DeviceGetResult, { ok: true }>): FetchReason {
  if (result.status === 429) return 'rate_limited';
  if (result.status === 404) return noneReason(result.bytes) ?? 'bad_status';
  return 'bad_status';
}

/** Why the listed files may not be downloaded at all, before one request is made. */
function listingFault(manifest: PremiumManifest, limits: FetchLimits): FetchReason | VerifyReason | null {
  if (manifest.files.some((f) => checkBundlePath(f.path) !== 'ok')) return 'bad_path';
  if (manifest.files.length > BUNDLE_MAX_FILES) return 'bad_layout';
  let total = 0;
  for (const file of manifest.files) {
    if (file.size > limits.fileBytes) return 'too_large';
    total += file.size;
  }
  return total > limits.totalBytes ? 'too_large' : null;
}

export async function fetchBundle(deps: BundleFetchDeps): Promise<FetchOutcome> {
  const limits = deps.limits ?? DEFAULT_FETCH_LIMITS;

  function done(outcome: FetchOutcome, sequence: number | null): FetchOutcome {
    deps.log.info({
      scope: 'premium',
      event: 'premium.bundle_fetch',
      outcome: outcome.ok ? 'ok' : outcome.reason,
      sequence,
    });
    return outcome;
  }

  function refused(reason: FetchReason | VerifyReason, sequence: number | null): FetchOutcome {
    return done({ ok: false, reason, sequence }, sequence);
  }

  async function get(req: Omit<DeviceGetRequest, 'signal'>): Promise<Extract<DeviceGetResult, { ok: true }> | FetchReason> {
    if (deps.signal.aborted) return 'aborted';
    const result = await deps.deviceGet({ ...req, signal: deps.signal });
    return result.ok ? result : result.reason;
  }

  const ctx = deps.context();
  const answer = await get({
    route: { r: 'bundle', query: { hostApi: ctx.hostApi, appVersion: ctx.appVersion, flavor: ctx.flavor } },
    maxBytes: limits.answerBytes,
  });
  if (typeof answer === 'string') return refused(answer, null);
  if (answer.status !== 200) return refused(statusReason(answer), null);
  const parsed = parseAnswer(answer.bytes);
  if (parsed === null) return refused('bad_answer', null);

  // The signature is judged before a single file is asked for.
  const signed = verifyManifest(parsed.manifestBytes, parsed.sig, { keys: ctx.keys });
  if (!signed.ok) return refused(signed.reason, null);
  const { manifest } = signed;
  if (manifest.sequence !== parsed.sequence) return refused('bad_answer', null);
  const { sequence } = manifest;

  const fault = listingFault(manifest, limits);
  if (fault !== null) return refused(fault, sequence);

  const files = new Map<string, Uint8Array>();
  for (const file of manifest.files) {
    const reply = await get({ route: { r: 'file', sequence, path: file.path }, maxBytes: file.size });
    if (typeof reply === 'string') return refused(reply, sequence);
    if (reply.status !== 200) return refused(statusReason(reply), sequence);
    files.set(file.path, reply.bytes);
  }

  const verified = verifyBundle({ manifestBytes: parsed.manifestBytes, sig: parsed.sig, files }, deps.context());
  deps.log.info({
    scope: 'premium',
    event: 'premium.bundle_verify',
    outcome: verified.ok ? 'ok' : verified.reason,
    sequence,
  });
  if (!verified.ok) return refused(verified.reason, sequence);
  return done({ ok: true, bundle: verified.bundle }, sequence);
}
