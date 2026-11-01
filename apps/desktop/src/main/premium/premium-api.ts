import {
  GAME_ACCOUNT_REPORT_FIELDS,
  readHandOffBody,
  readPremiumMeBody,
  readPremiumStatusBody,
  readPremiumMeAudience,
  readPremiumUserId,
  readPremiumVisibilityBody,
  readReportBody,
  readSessionTokenBody,
  readSignInRequestBody,
  type GameAccountReportField,
  type PremiumMe,
  type PremiumReportOutcome,
  type PremiumStatus,
} from '@bombfarm/contracts';
import type { LeaseEnvelope } from './licence/lease-verify.js';
import type { PremiumHttp, PremiumHttpRequest, PremiumHttpResponse } from './premium-transport.js';
import type { StoredSession } from './token-vault.js';

export interface GameAccountReport {
  readonly accountId: string;
  readonly steamId64: string;
  readonly playerName: string | null;
}

export type SignInStartResult =
  | { ok: true; approvalUrl: string }
  | { ok: false; reason: 'refused' | 'unreachable' | 'bad-response' };

export type ExchangeResult =
  | { ok: true; session: StoredSession }
  | { ok: false; reason: 'refused' | 'unreachable' | 'bad-response' };

export type RotateResult =
  | { ok: true; session: StoredSession }
  | { ok: false; reason: 'conflict' | 'unauthorized' | 'unreachable' | 'bad-response' };

export type FetchFailure =
  | { ok: false; reason: 'unauthorized' | 'unreachable' | 'bad-response' }
  | { ok: false; reason: 'rate-limited'; retryAfterSec?: number };

export type FetchResult<T> = { ok: true; value: T } | FetchFailure;

export type VisibilityResult =
  | { ok: true; visible: boolean }
  | { ok: false; reason: 'unreachable' | 'bad-response' }
  | { ok: false; reason: 'rate-limited'; retryAfterSec?: number };

export type ReportResult = PremiumReportOutcome | { kind: 'unauthorized' };

export type HandOffResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'unauthorized' | 'unreachable' | 'bad-response' };

/**
 * What a licence route answered, decoded but not yet judged: a Lease comes back as its envelope for
 * the caller to verify, and a refusal as the one outcome the machine knows it by. Every route's
 * unreachable, `5xx`, `429` and unparseable answers are `failed`, carrying `Retry-After` when sent.
 */
export type LicenceOutcome =
  | {
      readonly kind: 'lease';
      readonly envelope: LeaseEnvelope;
      /** Present on an activation answer. */
      readonly deviceId: string | null;
      /** The unsigned hint for the premium host, passed on unchanged. */
      readonly latestSequence: number | null;
    }
  | { readonly kind: 'heldElsewhere'; readonly holderName: string; readonly nextMoveAt: string | null }
  | { readonly kind: 'moveLimit'; readonly lastMoveAt: string; readonly nextMoveAt: string }
  | { readonly kind: 'mismatch' }
  | { readonly kind: 'premiumInactive' }
  | { readonly kind: 'foreign' }
  | { readonly kind: 'deviceSignature' }
  | { readonly kind: 'unauthorized' }
  | { readonly kind: 'notLeft' }
  | { readonly kind: 'cleanup'; readonly result: 'confirmed' | 'lapsed' }
  | { readonly kind: 'salt'; readonly fingerprintSalt: string }
  | { readonly kind: 'failed'; readonly retryAfterSec?: number };

export interface LicenceAnswer {
  readonly outcome: LicenceOutcome;
  /** The server's clock from this answer's `Date` header, for the signature offset; null when absent. */
  readonly dateMs: number | null;
}

/** A device-signed licence call: the `BFC-Device` value and the exact body string it signs. */
export interface DeviceSignedCall {
  readonly device: string;
  readonly body: string;
}

export interface PremiumApi {
  requestSignIn(input: { challenge: string; state: string; redirectUri: string }): Promise<SignInStartResult>;
  exchangeCode(input: { code: string; verifier: string; redirectUri: string }): Promise<ExchangeResult>;
  rotate(token: string): Promise<RotateResult>;
  fetchStatus(token: string): Promise<FetchResult<PremiumStatus>>;
  fetchMe(token: string): Promise<FetchResult<PremiumMe>>;
  /**
   * The user id that came with a `fetchMe` answer, or null. It rides beside the answer, never in it,
   * so the account view and its cache stay free of the id.
   */
  subjectOf?(me: PremiumMe): string | null;
  /** The audience that came with a `fetchMe` answer, or null; it rides beside the answer like the id. */
  audienceOf?(me: PremiumMe): 'owner' | 'tester' | 'public' | null;
  fetchVisibility(): Promise<VisibilityResult>;
  reportGameAccount(token: string, input: GameAccountReport): Promise<ReportResult>;
  requestHandOff(token: string): Promise<HandOffResult>;
  signOut(token: string): Promise<void>;
  /** `GET /v1/premium/licence`: the per-user fingerprint salt a first activation needs. */
  fetchLicenceSalt(token: string): Promise<LicenceAnswer>;
  activateLicence(token: string, call: DeviceSignedCall): Promise<LicenceAnswer>;
  renewLease(token: string, call: DeviceSignedCall): Promise<LicenceAnswer>;
  reportCleanup(token: string, call: DeviceSignedCall): Promise<LicenceAnswer>;
}

type Reached = { reached: true; response: PremiumHttpResponse } | { reached: false };

async function reach(http: PremiumHttp, req: PremiumHttpRequest): Promise<Reached> {
  try {
    return { reached: true, response: await http(req) };
  } catch {
    return { reached: false };
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function isSuccess(status: number): boolean {
  return status >= 200 && status < 300;
}

function isServerSide(status: number): boolean {
  return status === 404 || status >= 500;
}

function failureFor(response: PremiumHttpResponse): FetchFailure {
  if (response.status === 401) return { ok: false, reason: 'unauthorized' };
  if (response.status === 429) {
    return response.retryAfterSec === null
      ? { ok: false, reason: 'rate-limited' }
      : { ok: false, reason: 'rate-limited', retryAfterSec: response.retryAfterSec };
  }
  if (isServerSide(response.status)) return { ok: false, reason: 'unreachable' };
  return { ok: false, reason: 'bad-response' };
}

type LicenceRoute = 'salt' | 'activate' | 'lease' | 'cleanup';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function reasonOf(text: string): string | null {
  const reason = asRecord(parseJson(text))?.['reason'];
  return typeof reason === 'string' ? reason : null;
}

function licenceFailure(response: PremiumHttpResponse): LicenceOutcome {
  return response.retryAfterSec === null ? { kind: 'failed' } : { kind: 'failed', retryAfterSec: response.retryAfterSec };
}

function readLeaseAnswer(body: Record<string, unknown>, route: LicenceRoute): LicenceOutcome | null {
  const { lease, sig, keyId, deviceId } = body;
  if (typeof lease !== 'string' || typeof sig !== 'string' || typeof keyId !== 'string') return null;
  if (route === 'activate' && typeof deviceId !== 'string') return null;
  const sequence = asRecord(body['bundle'])?.['latestSequence'];
  return {
    kind: 'lease',
    envelope: { lease, sig, keyId },
    deviceId: typeof deviceId === 'string' ? deviceId : null,
    latestSequence: typeof sequence === 'number' && Number.isInteger(sequence) ? sequence : null,
  };
}

function decodeLicenceSuccess(response: PremiumHttpResponse, route: LicenceRoute): LicenceOutcome {
  const body = asRecord(parseJson(response.body));
  if (body === null) return licenceFailure(response);
  if (route === 'salt') {
    const salt = body['fingerprintSalt'];
    return typeof salt === 'string' && salt !== '' ? { kind: 'salt', fingerprintSalt: salt } : licenceFailure(response);
  }
  if (route === 'cleanup') {
    const result = body['cleanup'];
    return result === 'confirmed' || result === 'lapsed' ? { kind: 'cleanup', result } : licenceFailure(response);
  }
  return readLeaseAnswer(body, route) ?? licenceFailure(response);
}

function decodeLicenceRefusal(response: PremiumHttpResponse, route: LicenceRoute): LicenceOutcome {
  const reason = reasonOf(response.body);
  switch (response.status) {
    case 401:
      // The device signature is checked after the bearer, and only on routes that carry one.
      return route !== 'salt' && reason === 'device_signature' ? { kind: 'deviceSignature' } : { kind: 'unauthorized' };
    case 403:
      if (reason === 'device_foreign' && route !== 'salt') return { kind: 'foreign' };
      if (reason === 'premium_inactive' && route === 'activate') return { kind: 'premiumInactive' };
      return licenceFailure(response);
    case 409: {
      const body = asRecord(parseJson(response.body));
      if (reason === 'device_mismatch' && route !== 'salt') return { kind: 'mismatch' };
      if (reason === 'not_left' && route === 'cleanup') return { kind: 'notLeft' };
      if (reason === 'held_elsewhere' && route === 'activate' && body !== null) {
        const { holderName, nextMoveAt } = body;
        if (typeof holderName !== 'string') return licenceFailure(response);
        return { kind: 'heldElsewhere', holderName, nextMoveAt: typeof nextMoveAt === 'string' ? nextMoveAt : null };
      }
      if (reason === 'move_limit' && route === 'activate' && body !== null) {
        const { lastMoveAt, nextMoveAt } = body;
        if (typeof lastMoveAt !== 'string' || typeof nextMoveAt !== 'string') return licenceFailure(response);
        return { kind: 'moveLimit', lastMoveAt, nextMoveAt };
      }
      return licenceFailure(response);
    }
    default:
      // 400 invalid_body, 429, 502 and 503 (busy, licence_unconfigured) are all a try that failed.
      return licenceFailure(response);
  }
}

function decodeLicence(response: PremiumHttpResponse, route: LicenceRoute): LicenceAnswer {
  const outcome = isSuccess(response.status)
    ? decodeLicenceSuccess(response, route)
    : decodeLicenceRefusal(response, route);
  return { outcome, dateMs: response.dateMs ?? null };
}

export function createPremiumApi(http: PremiumHttp): PremiumApi {
  const subjects = new WeakMap<PremiumMe, string>();
  const audiences = new WeakMap<PremiumMe, 'owner' | 'tester' | 'public'>();

  async function licenceCall(req: PremiumHttpRequest, route: LicenceRoute): Promise<LicenceAnswer> {
    const reached = await reach(http, req);
    if (!reached.reached) return { outcome: { kind: 'failed' }, dateMs: null };
    return decodeLicence(reached.response, route);
  }

  function signed(
    path: 'licenceActivate' | 'lease' | 'licenceCleanup',
    token: string,
    call: DeviceSignedCall,
  ): PremiumHttpRequest {
    return { path, method: 'POST', token, rawBody: call.body, headers: { 'BFC-Device': call.device } };
  }

  async function readJson<T>(
    req: PremiumHttpRequest,
    read: (value: unknown) => T | null,
  ): Promise<FetchResult<T>> {
    const reached = await reach(http, req);
    if (!reached.reached) return { ok: false, reason: 'unreachable' };
    const { response } = reached;
    if (!isSuccess(response.status)) return failureFor(response);
    const value = read(parseJson(response.body));
    return value === null ? { ok: false, reason: 'bad-response' } : { ok: true, value };
  }

  function sessionOutcome(
    session: StoredSession | null,
  ): { ok: true; session: StoredSession } | { ok: false; reason: 'bad-response' } {
    return session === null ? { ok: false, reason: 'bad-response' } : { ok: true, session };
  }

  return {
    async requestSignIn({ challenge, state, redirectUri }) {
      const reached = await reach(http, {
        path: 'signInRequest',
        method: 'POST',
        body: { codeChallenge: challenge, codeChallengeMethod: 'S256', redirectUri, state },
      });
      if (!reached.reached) return { ok: false, reason: 'unreachable' };
      const { response } = reached;
      if (response.status === 400) return { ok: false, reason: 'refused' };
      if (response.status === 429 || isServerSide(response.status)) return { ok: false, reason: 'unreachable' };
      if (!isSuccess(response.status)) return { ok: false, reason: 'bad-response' };
      const body = readSignInRequestBody(parseJson(response.body));
      return body === null ? { ok: false, reason: 'bad-response' } : { ok: true, approvalUrl: body.approvalUrl };
    },

    async exchangeCode({ code, verifier, redirectUri }) {
      const reached = await reach(http, {
        path: 'token',
        method: 'POST',
        body: { code, codeVerifier: verifier, redirectUri },
      });
      if (!reached.reached) return { ok: false, reason: 'unreachable' };
      const { response } = reached;
      if (response.status === 400) return { ok: false, reason: 'refused' };
      if (response.status === 429 || isServerSide(response.status)) return { ok: false, reason: 'unreachable' };
      if (!isSuccess(response.status)) return { ok: false, reason: 'bad-response' };
      return sessionOutcome(readSessionTokenBody(parseJson(response.body)));
    },

    async rotate(token) {
      const reached = await reach(http, { path: 'rotate', method: 'POST', token });
      if (!reached.reached) return { ok: false, reason: 'unreachable' };
      const { response } = reached;
      if (response.status === 409) return { ok: false, reason: 'conflict' };
      if (response.status === 401) return { ok: false, reason: 'unauthorized' };
      if (response.status === 429 || isServerSide(response.status)) return { ok: false, reason: 'unreachable' };
      if (!isSuccess(response.status)) return { ok: false, reason: 'bad-response' };
      return sessionOutcome(readSessionTokenBody(parseJson(response.body)));
    },

    fetchStatus(token) {
      return readJson({ path: 'status', method: 'GET', token }, readPremiumStatusBody);
    },

    fetchMe(token) {
      return readJson({ path: 'me', method: 'GET', token }, (value) => {
        const me = readPremiumMeBody(value);
        const userId = readPremiumUserId(value);
        if (me !== null && userId !== null) subjects.set(me, userId);
        const audience = readPremiumMeAudience(value);
        if (me !== null && audience !== null) audiences.set(me, audience);
        return me;
      });
    },

    subjectOf: (me) => subjects.get(me) ?? null,

    audienceOf: (me) => audiences.get(me) ?? null,

    async fetchVisibility() {
      const result = await readJson({ path: 'visibility', method: 'GET' }, readPremiumVisibilityBody);
      if (result.ok) return { ok: true, visible: result.value };
      if (result.reason === 'rate-limited') return result;
      return { ok: false, reason: result.reason === 'unreachable' ? 'unreachable' : 'bad-response' };
    },

    async reportGameAccount(token, { accountId, steamId64, playerName }) {
      const values: Record<GameAccountReportField, string | null> = {
        account_id: accountId,
        steam_id64: steamId64,
        player_name: playerName,
      };
      const body: Record<string, string> = {};
      for (const field of GAME_ACCOUNT_REPORT_FIELDS) {
        const value = values[field];
        if (value !== null) body[field] = value;
      }
      const reached = await reach(http, { path: 'report', method: 'POST', token, body });
      if (!reached.reached) return { kind: 'failed' };
      const { response } = reached;
      if (response.status === 401) return { kind: 'unauthorized' };
      return readReportBody(response.status, parseJson(response.body));
    },

    async requestHandOff(token) {
      const reached = await reach(http, { path: 'handOff', method: 'POST', token });
      if (!reached.reached) return { ok: false, reason: 'unreachable' };
      const { response } = reached;
      if (response.status === 401) return { ok: false, reason: 'unauthorized' };
      if (response.status === 429 || isServerSide(response.status)) return { ok: false, reason: 'unreachable' };
      if (!isSuccess(response.status)) return { ok: false, reason: 'bad-response' };
      const body = readHandOffBody(parseJson(response.body));
      return body === null ? { ok: false, reason: 'bad-response' } : { ok: true, url: body.url };
    },

    async signOut(token) {
      await reach(http, { path: 'signOut', method: 'POST', token });
    },

    fetchLicenceSalt(token) {
      return licenceCall({ path: 'licence', method: 'GET', token }, 'salt');
    },

    activateLicence(token, call) {
      return licenceCall(signed('licenceActivate', token, call), 'activate');
    },

    renewLease(token, call) {
      return licenceCall(signed('lease', token, call), 'lease');
    },

    reportCleanup(token, call) {
      return licenceCall(signed('licenceCleanup', token, call), 'cleanup');
    },
  };
}
