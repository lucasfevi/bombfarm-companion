import { describe, expect, it } from 'vitest';
import { gameProcessQuery, isProcessAlive, pinnedGamePid, stripExeSuffix } from './process.js';

/**
 * The real function, not a mock. `isProcessAlive` is what the game reader's recurring tick uses
 * instead of spawning PowerShell, so its two answers are load-bearing: a wrong `false` costs a
 * ~166ms process spawn on every one of those ticks, and a wrong `true` reports a game that has
 * already closed as still running.
 *
 * `findProcessId` and the PowerShell helpers beside it are deliberately not exercised here — they
 * shell out, which a unit test must not do.
 */
describe('isProcessAlive', () => {
  it('says yes for a process that is certainly running — this one', () => {
    expect(isProcessAlive(process.pid)).toBe(true);
  });

  it('says no for a pid nothing can be running under', () => {
    // Above every platform's pid ceiling, so it cannot collide with a real process on the machine
    // running these tests.
    expect(isProcessAlive(0x7ffffffe)).toBe(false);
  });

  it('sends no signal — asking whether a process exists must never disturb it', () => {
    // Signal 0 is the existence check. If this ever became a real signal, asking about our own pid
    // would terminate the test run rather than return.
    expect(isProcessAlive(process.pid)).toBe(true);
    expect(isProcessAlive(process.pid)).toBe(true);
  });
});

describe('stripExeSuffix', () => {
  it('drops a trailing .exe, case-insensitively, because Get-Process names carry none', () => {
    expect(stripExeSuffix('BombFarm.exe')).toBe('BombFarm');
    expect(stripExeSuffix('BombFarm.EXE')).toBe('BombFarm');
    expect(stripExeSuffix('BombFarm')).toBe('BombFarm');
  });

  it('leaves an .exe that is not the suffix alone', () => {
    expect(stripExeSuffix('exe.game')).toBe('exe.game');
  });
});

describe('pinnedGamePid', () => {
  it('is no pin when BFC_GAME_PID is absent or blank', () => {
    expect(pinnedGamePid({})).toBeNull();
    expect(pinnedGamePid({ BFC_GAME_PID: '' })).toBeNull();
    expect(pinnedGamePid({ BFC_GAME_PID: '   ' })).toBeNull();
  });

  it('reads a positive integer, tolerating surrounding whitespace', () => {
    expect(pinnedGamePid({ BFC_GAME_PID: '12345' })).toBe(12345);
    expect(pinnedGamePid({ BFC_GAME_PID: ' 42 ' })).toBe(42);
  });

  it('throws on anything else rather than silently attaching to whichever instance comes first', () => {
    for (const raw of ['abc', '0', '-3', '12.5', '1e3', '0x10']) {
      expect(() => pinnedGamePid({ BFC_GAME_PID: raw })).toThrow(/BFC_GAME_PID/);
    }
  });
});

describe('gameProcessQuery', () => {
  it('looks the game up by name alone when nothing is pinned', () => {
    expect(gameProcessQuery('BombFarm.exe', {})).toBe(
      "Get-Process -Name 'BombFarm' -ErrorAction SilentlyContinue",
    );
  });

  it('narrows the same lookup to the pinned pid, so a pid of another program never matches', () => {
    expect(gameProcessQuery('BombFarm.exe', { BFC_GAME_PID: '777' })).toBe(
      "Get-Process -Name 'BombFarm' -ErrorAction SilentlyContinue | Where-Object { $_.Id -eq 777 }",
    );
  });
});
