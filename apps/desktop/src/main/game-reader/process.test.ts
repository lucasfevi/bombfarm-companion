import { describe, expect, it } from 'vitest';
import { isProcessAlive, stripExeSuffix } from './process.js';

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
