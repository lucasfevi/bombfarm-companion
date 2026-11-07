import type { SignedFixture, FixtureOptions } from './sign-fixture.mjs';

export const TRACKING_CAPABILITIES: readonly string[];
export const TRACKING_HOST_API: string;
export const TOKEN_MARKER: string;
export const OTHER_SECTION_MARKER: string;
export const LINKED_PAIR: Readonly<{ accountId: string; steamId64: string; token: string }>;
export const OTHER_ACCOUNT_ID: string;
export const PLAYER_NAME: string;
export const BUNDLE_MARKER: string;
export const BATTLE_LOG_FILES: readonly string[];

export function trackingBundle(options?: FixtureOptions): SignedFixture;
export function captureBody(): Record<string, unknown>;
export function captureFrame(): Record<string, unknown>;
/** Writes the one-frame, one-body replay capture to `file`; returns `file`. */
export function writeTrackingCapture(file: string): string;
/** Copies the battle-log fixture folder into `dir`; returns `dir`. */
export function stageBattleLogFolder(dir: string): string;
