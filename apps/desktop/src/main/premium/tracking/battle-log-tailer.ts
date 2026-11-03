import type { GrantedConsent } from '@bombfarm/game-api';
import {
  parseGameLanguage,
  readGameFile,
  statGameFile,
  type BattleLogFsPort,
  type FileStat,
} from '../../game-api/battle-log-file.js';

export const BATTLE_LOG_POLL_MS = 2_000;
export const BATTLE_LOG_RETRY_MS = 250;
export const BATTLE_LOG_MAX_TRIES = 3;

/** What the tailer hands over for one change; the capability adds the feed's `seq`. */
export interface BattleLogPayload {
  readonly atMs: number;
  readonly accountKey: string;
  /** `acc_${accountKey}`. */
  readonly section: string;
  readonly text: string;
  readonly mtimeMs: number;
  readonly gameLanguage: string | null;
  readonly baseline: boolean;
}

export interface BattleLogTailerDeps {
  /** The granted consent, or `null` while the player has not granted it: then nothing is read. */
  consent(): GrantedConsent | null;
  /** The licensed playing account, or `null` when Premium may not run for the account playing. */
  licensedAccountId(): string | null;
  readonly fs: BattleLogFsPort;
  readonly battleLogPath: string;
  readonly settingsPath: string;
  now(): number;
  /** Returns whether the payload was accepted; a refused one is offered again on the next check. */
  send(payload: BattleLogPayload): boolean;
  /** Early wake from the folder; the poll alone is enough when absent. Returns the way to stop. */
  watch?(wake: () => void): () => void;
}

export interface BattleLogTailer {
  /** Begin watching; the first send after this carries `baseline: true`. */
  start(): void;
  stop(): void;
  /** Check now instead of at the next poll (a refused send may be accepted now). */
  poke(): void;
}

const SECTION_HEADER = /^\[[^\]]+\]$/;

/** The body of `[acc_<id>]` without its header, trailing blank lines trimmed; `null` when absent. */
export function extractSection(text: string, accountId: string): string | null {
  const lines = text.split(/\r?\n/);
  const header = `[acc_${accountId}]`;
  const start = lines.findIndex((line) => line.trim() === header);
  if (start === -1) return null;
  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (SECTION_HEADER.test(line.trim())) break;
    body.push(line);
  }
  while (body.length > 0 && (body[body.length - 1] ?? '').trim() === '') body.pop();
  return body.join('\n');
}

/** Complete means the text after `entries=` parses as a JSON array; anything else is a torn write. */
export function isCompleteSection(body: string): boolean {
  const marker = /(^|\n)entries=/.exec(body);
  if (marker === null) return false;
  try {
    return Array.isArray(JSON.parse(body.slice(marker.index + marker[0].length)));
  } catch {
    return false;
  }
}

const signature = (stat: FileStat): string => `${String(stat.mtimeMs)}:${String(stat.size)}`;

/**
 * Watches the game's battle log and hands over the licensed account's section whenever it changes:
 * `stat` every 2 s (plus an optional folder wake), read, `stat` again and re-read when the file
 * moved during the read. Other accounts' sections are never copied or kept; nothing here throws,
 * and nothing in a payload names the path.
 */
export function createBattleLogTailer(deps: BattleLogTailerDeps): BattleLogTailer {
  let running = false;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let unwatch: (() => void) | undefined;
  /** The file state already dealt with: sent, equal to the last send, or without the section. */
  let handled: { signature: string; accountId: string } | null = null;
  let lastSent: { accountId: string; text: string } | null = null;
  let baseline = true;

  function attempt(tries: number): void {
    const consent = deps.consent();
    const accountId = deps.licensedAccountId();
    if (consent === null || accountId === null) return;
    const before = statGameFile(consent, deps.fs, deps.battleLogPath);
    if (before === null) return;
    const seen = signature(before);
    if (handled !== null && handled.signature === seen && handled.accountId === accountId) return;

    const file = readGameFile(consent, deps.fs, deps.battleLogPath);
    if (!file.ok) return;
    const after = statGameFile(consent, deps.fs, deps.battleLogPath);
    if (after === null || signature(after) !== seen) {
      if (tries + 1 < BATTLE_LOG_MAX_TRIES) {
        retryTimer = setTimeout(() => {
          retryTimer = undefined;
          guarded(tries + 1);
        }, BATTLE_LOG_RETRY_MS);
      }
      return;
    }

    const body = extractSection(file.text, accountId);
    if (body === null) {
      handled = { signature: seen, accountId };
      return;
    }
    if (!isCompleteSection(body)) return;
    if (lastSent !== null && lastSent.accountId === accountId && lastSent.text === body) {
      handled = { signature: seen, accountId };
      return;
    }

    const settings = readGameFile(consent, deps.fs, deps.settingsPath);
    const accepted = deps.send({
      atMs: deps.now(),
      accountKey: accountId,
      section: `acc_${accountId}`,
      text: body,
      mtimeMs: after.mtimeMs,
      gameLanguage: settings.ok ? parseGameLanguage(settings.text) : null,
      baseline: baseline || lastSent === null || lastSent.accountId !== accountId,
    });
    if (!accepted) return;
    lastSent = { accountId, text: body };
    baseline = false;
    handled = { signature: seen, accountId };
  }

  function guarded(tries: number): void {
    if (!running) return;
    try {
      attempt(tries);
    } catch {
      // A failed check is a normal state; the next poll tries again.
    }
  }

  function check(): void {
    if (retryTimer !== undefined) return;
    guarded(0);
  }

  return {
    start() {
      if (running) return;
      running = true;
      handled = null;
      lastSent = null;
      baseline = true;
      pollTimer = setInterval(check, BATTLE_LOG_POLL_MS);
      pollTimer.unref();
      try {
        unwatch = deps.watch?.(check);
      } catch {
        unwatch = undefined;
      }
      check();
    },
    stop() {
      running = false;
      if (pollTimer !== undefined) clearInterval(pollTimer);
      if (retryTimer !== undefined) clearTimeout(retryTimer);
      pollTimer = undefined;
      retryTimer = undefined;
      unwatch?.();
      unwatch = undefined;
    },
    poke: check,
  };
}
