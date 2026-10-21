import {
  GAME_ACCOUNT_REPORT_FIELDS,
  readHandOffBody,
  readPremiumMeBody,
  readPremiumStatusBody,
  readPremiumVisibilityBody,
  readReportBody,
  readSessionTokenBody,
  readSignInRequestBody,
  type GameAccountReportField,
  type PremiumMe,
  type PremiumReportOutcome,
  type PremiumStatus,
} from '@bombfarm/contracts';
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

export interface PremiumApi {
  requestSignIn(input: { challenge: string; state: string; redirectUri: string }): Promise<SignInStartResult>;
  exchangeCode(input: { code: string; verifier: string; redirectUri: string }): Promise<ExchangeResult>;
  rotate(token: string): Promise<RotateResult>;
  fetchStatus(token: string): Promise<FetchResult<PremiumStatus>>;
  fetchMe(token: string): Promise<FetchResult<PremiumMe>>;
  fetchVisibility(): Promise<VisibilityResult>;
  reportGameAccount(token: string, input: GameAccountReport): Promise<ReportResult>;
  requestHandOff(token: string): Promise<HandOffResult>;
  signOut(token: string): Promise<void>;
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

export function createPremiumApi(http: PremiumHttp): PremiumApi {
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
      return readJson({ path: 'me', method: 'GET', token }, readPremiumMeBody);
    },

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
  };
}
