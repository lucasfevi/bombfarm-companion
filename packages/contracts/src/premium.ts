import type { PremiumHostView } from './premium-host.js';
import type { PremiumLicenceView } from './premium-licence.js';

export const PREMIUM_REFRESH_FLOOR_MS = 30_000;
export const PREMIUM_REFRESH_EVERY_MS = 3_600_000;
export const PREMIUM_SIGN_IN_TIMEOUT_MS = 300_000;

export type PremiumKind = 'subscription' | 'pass' | 'manual_grant';
export type PremiumSignInMethod = 'discord' | 'google' | 'steam';

export interface PremiumStatus {
  readonly active: boolean;
  readonly kinds: readonly PremiumKind[];
  readonly until: string | null;
  readonly awaitingPaymentUntil: string | null;
  readonly graceUntil: string | null;
  readonly cancellationAt: string | null;
  readonly paymentFailed: boolean;
  readonly pendingFirstPayment: boolean;
  readonly disputeHold: boolean;
}

export interface PremiumMe {
  readonly methods: readonly PremiumSignInMethod[];
  readonly steamVerified: boolean;
  readonly gameAccountLinked: boolean;
  readonly admitted: boolean;
}

export type PremiumSignInEnd =
  | 'cancelled'
  | 'timed-out'
  | 'declined'
  | 'refused'
  | 'unreachable'
  | 'bad-response'
  | 'port-unavailable'
  | 'browser-unavailable';

export type PremiumReportRefusal = 'steam_mismatch' | 'no_steam_id' | 'game_account_taken' | 'unknown';

export type PremiumReportOutcome =
  | { kind: 'linked' }
  | { kind: 'refused'; reason: PremiumReportRefusal }
  | { kind: 'not-sent'; reason: 'no-steam-id' | 'no-game-account' }
  | { kind: 'failed' };

export type PremiumActionResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'already-signing-in' | 'already-signed-in' | 'signed-out' | 'too-soon' | 'failed' | 'unavailable';
    };

export const PREMIUM_ACCOUNT_UNKNOWN_REASONS = [
  'signed_out',
  'no_session',
  'no_steam_id64',
  'checking',
  'report_failed',
] as const;
export const PREMIUM_ACCOUNT_OTHER_REASONS = ['other_account', 'no_steam_link'] as const;

/**
 * Whether the game account playing right now is the signed-in user's linked one. Carries no id of
 * any kind: the state and a fixed reason word are all that leave the main process.
 */
export type PremiumPlayingAccount =
  | { readonly state: 'linked'; readonly reason: null }
  | { readonly state: 'other'; readonly reason: (typeof PREMIUM_ACCOUNT_OTHER_REASONS)[number] }
  | { readonly state: 'unknown'; readonly reason: (typeof PREMIUM_ACCOUNT_UNKNOWN_REASONS)[number] };

export const signedOutPlayingAccount: PremiumPlayingAccount = { state: 'unknown', reason: 'signed_out' };

export interface PremiumView {
  readonly session: 'signed-out' | 'signing-in' | 'signed-in';
  readonly playingAccount: PremiumPlayingAccount;
  readonly rememberedAcrossRestarts: boolean;
  readonly lastSignInEnd: PremiumSignInEnd | null;
  readonly ended: 'expired' | null;
  readonly visible: boolean;
  readonly me: PremiumMe | null;
  readonly status: PremiumStatus | null;
  readonly fetchedAt: string | null;
  readonly lastRefreshFailed: boolean;
  readonly report: PremiumReportOutcome | null;
  readonly reportedAccountId: string | null;
  readonly licence: PremiumLicenceView | null;
  readonly host: PremiumHostView | null;
}

export const signedOutPremiumView: PremiumView = {
  session: 'signed-out',
  playingAccount: signedOutPlayingAccount,
  rememberedAcrossRestarts: true,
  lastSignInEnd: null,
  ended: null,
  visible: false,
  me: null,
  status: null,
  fetchedAt: null,
  lastRefreshFailed: false,
  report: null,
  reportedAccountId: null,
  licence: null,
  host: null,
};

export interface GameAccountReportBody {
  readonly account_id: string;
  readonly steam_id64: string;
  readonly player_name?: string;
}

export const GAME_ACCOUNT_REPORT_FIELDS = ['account_id', 'steam_id64', 'player_name'] as const;
export type GameAccountReportField = (typeof GAME_ACCOUNT_REPORT_FIELDS)[number];

type Exhaustive<Listed, Declared> = [Exclude<Declared, Listed>, Exclude<Listed, Declared>] extends [never, never]
  ? true
  : never;

export const GAME_ACCOUNT_REPORT_FIELDS_ARE_EXHAUSTIVE: Exhaustive<
  GameAccountReportField,
  keyof GameAccountReportBody
> = true;

export const REPORTED_PLAYER_NAME_MAX_LENGTH = 64;

/** `length` counts UTF-16 units, never fewer than characters, so a name this accepts fits the API's limit. */
export function reportablePlayerName(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= REPORTED_PLAYER_NAME_MAX_LENGTH ? trimmed : null;
}

const KINDS: readonly PremiumKind[] = ['subscription', 'pass', 'manual_grant'];
const METHODS: readonly PremiumSignInMethod[] = ['discord', 'google', 'steam'];
const REFUSALS: readonly PremiumReportRefusal[] = ['steam_mismatch', 'no_steam_id', 'game_account_taken'];

export function isSteamId64(value: string): boolean {
  return /^\d{17}$/.test(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringOrNull(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === 'string' ? value : undefined;
}

function nestedDate(states: Record<string, unknown>, key: string, field: string): string | null | undefined {
  const entry = states[key];
  if (entry === null) return null;
  const record = asRecord(entry);
  if (record === null) return undefined;
  const date = record[field];
  return typeof date === 'string' ? date : undefined;
}

function pickKnown<T extends string>(value: unknown, known: readonly T[]): T[] | null {
  if (!Array.isArray(value)) return null;
  const out: T[] = [];
  for (const item of value) {
    if (typeof item === 'string' && (known as readonly string[]).includes(item) && !out.includes(item as T)) {
      out.push(item as T);
    }
  }
  return out;
}

export function readPremiumStatusBody(value: unknown): PremiumStatus | null {
  const body = asRecord(value);
  if (body === null) return null;
  const active = body['active'];
  const until = stringOrNull(body['until']);
  const kinds = pickKnown<PremiumKind>(body['kinds'], KINDS);
  const states = asRecord(body['states']);
  if (typeof active !== 'boolean' || until === undefined || kinds === null || states === null) return null;
  const awaitingPaymentUntil = nestedDate(states, 'awaitingPayment', 'until');
  const graceUntil = nestedDate(states, 'grace', 'until');
  const cancellationAt = nestedDate(states, 'cancellationScheduled', 'at');
  const paymentFailed = states['paymentFailed'];
  const pendingFirstPayment = states['pendingFirstPayment'];
  const disputeHold = states['disputeHold'];
  if (
    awaitingPaymentUntil === undefined ||
    graceUntil === undefined ||
    cancellationAt === undefined ||
    typeof paymentFailed !== 'boolean' ||
    typeof pendingFirstPayment !== 'boolean' ||
    typeof disputeHold !== 'boolean'
  ) {
    return null;
  }
  return {
    active,
    kinds,
    until,
    awaitingPaymentUntil,
    graceUntil,
    cancellationAt,
    paymentFailed,
    pendingFirstPayment,
    disputeHold,
  };
}

export function readPremiumMeBody(value: unknown): PremiumMe | null {
  const body = asRecord(value);
  if (body === null || body['v'] !== 1) return null;
  const methods = pickKnown<PremiumSignInMethod>(body['signInMethods'], METHODS);
  const steamVerified = body['steamVerified'];
  const gameAccountLinked = body['gameAccountLinked'];
  const admitted = body['admitted'];
  if (
    methods === null ||
    typeof steamVerified !== 'boolean' ||
    typeof gameAccountLinked !== 'boolean' ||
    typeof admitted !== 'boolean'
  ) {
    return null;
  }
  return { methods, steamVerified, gameAccountLinked, admitted };
}

/**
 * The signed-in user's id from the account answer, kept apart from `readPremiumMeBody` on purpose:
 * the view never carries it. Null for a missing, empty or non-text value.
 */
export function readPremiumUserId(value: unknown): string | null {
  const userId = asRecord(value)?.['userId'];
  return typeof userId === 'string' && userId !== '' ? userId : null;
}

/**
 * Who the signed-in account is for, from the account answer, kept apart from `readPremiumMeBody`
 * like the user id: the view never carries it. Anything but the three known values is null.
 */
export function readPremiumMeAudience(value: unknown): 'owner' | 'tester' | 'public' | null {
  const audience = asRecord(value)?.['audience'];
  return audience === 'owner' || audience === 'tester' || audience === 'public' ? audience : null;
}

export function readPremiumVisibilityBody(value: unknown): boolean | null {
  const body = asRecord(value);
  if (body === null) return null;
  const visible = body['visible'];
  return typeof visible === 'boolean' ? visible : null;
}

function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

export function readSignInRequestBody(value: unknown): { approvalUrl: string } | null {
  const body = asRecord(value);
  if (body === null) return null;
  const approvalUrl = httpsUrl(body['approvalUrl']);
  return approvalUrl === null ? null : { approvalUrl };
}

export function readHandOffBody(value: unknown): { url: string } | null {
  const body = asRecord(value);
  if (body === null) return null;
  const url = httpsUrl(body['url']);
  return url === null ? null : { url };
}

export function readSessionTokenBody(
  value: unknown,
): { token: string; expiresAt: string; rotateAfter: string } | null {
  const body = asRecord(value);
  if (body === null) return null;
  const { token, expiresAt, rotateAfter } = body;
  if (typeof token !== 'string' || typeof expiresAt !== 'string' || typeof rotateAfter !== 'string') return null;
  return { token, expiresAt, rotateAfter };
}

export function readReportBody(status: number, value: unknown): PremiumReportOutcome {
  const body = asRecord(value);
  if (status === 200) {
    return body !== null && body['outcome'] === 'linked' ? { kind: 'linked' } : { kind: 'failed' };
  }
  if (status === 409) {
    const reason = body === null ? undefined : body['reason'];
    const known = REFUSALS.find((candidate) => candidate === reason);
    return { kind: 'refused', reason: known ?? 'unknown' };
  }
  return { kind: 'failed' };
}
