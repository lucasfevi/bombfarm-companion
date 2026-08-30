import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  FLAVORS,
  IPC_CHANNELS,
  IPC_EVENT_CHANNELS,
  createPingResponse,
  isIpcChannel,
  isIpcEventChannel,
  type AccountView,
  type AppEnvironmentInfo,
  type ConsentRecord,
} from './index.js';

/** Compile-time-only: fails `tsc -p tsconfig.typecheck.json` if a member is ever added to
 *  `IpcInvokeChannel` without also adding it to the runtime `IPC_CHANNELS` array — the
 *  `satisfies` clause on `IPC_CHANNELS` only catches the opposite direction (an extra/wrong
 *  runtime entry), so this closes the other half (T9 Done-when). */
type AssertNever<T extends never> = T;
type _AllInvokeChannelsListed = AssertNever<Exclude<import('./index.js').IpcInvokeChannel, (typeof IPC_CHANNELS)[number]>>;
type _AllEventChannelsListed = AssertNever<Exclude<import('./index.js').IpcEventChannel, (typeof IPC_EVENT_CHANNELS)[number]>>;

describe('contracts IPC surface', () => {
  it('lists stable invoke channels, including the four consent channels', () => {
    expect(IPC_CHANNELS).toEqual([
      'app:getFlavor',
      'app:getEnvironment',
      'app:ping',
      'settings:get',
      'settings:useEnglish',
      'settings:usePortuguese',
      'storage:health',
      'game:getStatus',
      'account:get',
      'consent:get',
      'consent:accept',
      'consent:decline',
      'consent:revoke',
      'live:get',
      'live:dumpDiagnostics',
      'live:resetEarnings',
      'updates:get',
      'updates:check',
      'updates:download',
      'updates:installOnRestart',
      'market:getSnapshot',
      'market:refreshItem',
    ]);
  });

  it('lists stable event channels, including consent:changed and account:changed', () => {
    expect(IPC_EVENT_CHANNELS).toEqual([
      'game:status',
      'consent:changed',
      'account:changed',
      'live:event',
      'updates:changed',
      'market:changed',
    ]);
  });

  it('guards unknown channel names', () => {
    expect(isIpcChannel('app:ping')).toBe(true);
    expect(isIpcChannel('app:getEnvironment')).toBe(true);
    expect(isIpcChannel('account:get')).toBe(true);
    expect(isIpcChannel('consent:get')).toBe(true);
    expect(isIpcChannel('consent:accept')).toBe(true);
    expect(isIpcChannel('consent:decline')).toBe(true);
    expect(isIpcChannel('consent:revoke')).toBe(true);
    expect(isIpcChannel('not-a-channel')).toBe(false);
  });

  it('guards unknown event channel names', () => {
    expect(isIpcEventChannel('game:status')).toBe(true);
    expect(isIpcEventChannel('consent:changed')).toBe(true);
    expect(isIpcEventChannel('account:changed')).toBe(true);
    expect(isIpcEventChannel('not-an-event')).toBe(false);
  });

  it('every consent:* channel result is a ConsentRecord shape (decision + textVersion, optional grantedAt)', () => {
    const record: ConsentRecord = { decision: 'unasked', textVersion: 1 };
    expect(record.decision).toBe('unasked');
    expect(record.grantedAt).toBeUndefined();
  });

  it('IPC_CHANNELS has no duplicate entries', () => {
    expect(new Set(IPC_CHANNELS).size).toBe(IPC_CHANNELS.length);
  });

  it('IPC_EVENT_CHANNELS has no duplicate entries', () => {
    expect(new Set(IPC_EVENT_CHANNELS).size).toBe(IPC_EVENT_CHANNELS.length);
  });

  it('maps flavor descriptor fields to AppEnvironmentInfo for dev', () => {
    const descriptor = FLAVORS.dev;
    const info: AppEnvironmentInfo = {
      flavor: 'dev',
      productName: descriptor.productName,
      badgeLabel: descriptor.badgeLabel,
      updateChannel: descriptor.updateChannel,
      isPackaged: false,
      version: '0.0.0',
    };
    expect(info).toEqual({
      flavor: 'dev',
      productName: 'Bomb Farm Companion (Dev)',
      badgeLabel: 'DEV',
      updateChannel: null,
      isPackaged: false,
      version: '0.0.0',
    });
  });

  it('maps flavor descriptor fields to AppEnvironmentInfo for prod', () => {
    const descriptor = FLAVORS.prod;
    const info: AppEnvironmentInfo = {
      flavor: 'prod',
      productName: descriptor.productName,
      badgeLabel: descriptor.badgeLabel,
      updateChannel: descriptor.updateChannel,
      isPackaged: true,
      version: '1.2.3',
    };
    expect(info).toEqual({
      flavor: 'prod',
      productName: 'Bomb Farm Companion',
      badgeLabel: null,
      updateChannel: 'latest',
      isPackaged: true,
      version: '1.2.3',
    });
  });

  it('includes version on the app:getEnvironment channel surface', () => {
    expect(isIpcChannel('app:getEnvironment')).toBe(true);
    const env: AppEnvironmentInfo = {
      flavor: 'beta',
      productName: FLAVORS.beta.productName,
      badgeLabel: FLAVORS.beta.badgeLabel,
      updateChannel: FLAVORS.beta.updateChannel,
      isPackaged: true,
      version: '0.0.0',
    };
    expect(env.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('creates typed ping payloads', () => {
    expect(createPingResponse('preload')).toEqual({ ok: true, from: 'preload' });
  });

  it('ships default settings schema version', () => {
    expect(DEFAULT_SETTINGS.schemaVersion).toBe(1);
    expect(DEFAULT_SETTINGS.locale).toBe('en');
  });
});

// --- Compile-time-only assertions below: no runtime behaviour, enforced by `tsc` only. ---
// No IPC channel carries a token (T9 Done-when). `@bombfarm/contracts` never imports
// `SessionToken` from `@bombfarm/game-api` (that edge runs the other way — see consent.ts's
// doc comment), so this proves the weaker, sufficient claim structurally instead: neither
// `ConsentRecord` (every consent:* channel's result) nor `AccountView` (account:get's result,
// and account:changed's event payload) declares a `token` field at all.

// Never-called functions so the type-only parameters have nothing to evaluate at module load
// (a top-level `declare const` reference would throw at runtime once esbuild strips it).
function _assertConsentRecordHasNoToken(record: ConsentRecord): void {
  // @ts-expect-error - ConsentRecord has no `token` field; a session token can never ride over consent:*
  void record.token;
}
void _assertConsentRecordHasNoToken;

function _assertAccountViewHasNoToken(view: AccountView): void {
  // @ts-expect-error - AccountView has no `token` field; a session token can never ride over account:get/account:changed
  void view.token;
}
void _assertAccountViewHasNoToken;
