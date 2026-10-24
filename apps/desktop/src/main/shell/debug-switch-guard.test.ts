import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findForbiddenDebugSwitch, refuseDebugSwitchesWhenPackaged } from './debug-switch-guard.js';

const EXE = 'C:\\Users\\player\\AppData\\Local\\Programs\\Bomb Farm Companion\\Bomb Farm Companion.exe';

describe('findForbiddenDebugSwitch', () => {
  it.each([
    '--remote-debugging-port=9222',
    '--remote-debugging-port=0',
    '--remote-debugging-pipe',
    '--remote-debugging-address=0.0.0.0',
    '--remote-allow-origins=*',
    '--inspect',
    '--inspect=0',
    '--inspect-brk=9229',
    '--inspect-port=9229',
    '--inspect-publish-uid=http',
    '--js-flags=--expose-gc',
  ])('flags %s', (argument) => {
    expect(findForbiddenDebugSwitch([EXE, argument])).toBe(argument);
  });

  it('flags the switch whatever its case', () => {
    expect(findForbiddenDebugSwitch([EXE, '--Remote-Debugging-Port=9222'])).toBe('--Remote-Debugging-Port=9222');
    expect(findForbiddenDebugSwitch([EXE, '--INSPECT'])).toBe('--INSPECT');
  });

  it('flags the single-dash and slash spellings Chromium also reads on Windows', () => {
    expect(findForbiddenDebugSwitch([EXE, '-remote-debugging-port=9222'])).toBe('-remote-debugging-port=9222');
    expect(findForbiddenDebugSwitch([EXE, '/remote-debugging-port=9222'])).toBe('/remote-debugging-port=9222');
    expect(findForbiddenDebugSwitch([EXE, '-inspect=0'])).toBe('-inspect=0');
  });

  it('flags the switch when its value is a separate argument', () => {
    expect(findForbiddenDebugSwitch([EXE, '--remote-debugging-port', '9222'])).toBe('--remote-debugging-port');
    expect(findForbiddenDebugSwitch([EXE, '--js-flags', '--expose-gc'])).toBe('--js-flags');
  });

  it('flags the switch wherever it sits in the arguments', () => {
    expect(findForbiddenDebugSwitch([EXE, '--lang=en', '--no-sandbox', '--remote-debugging-port=1'])).toBe(
      '--remote-debugging-port=1',
    );
  });

  it('lets ordinary arguments through', () => {
    expect(
      findForbiddenDebugSwitch([EXE, '--squirrel-firstrun', '--lang=pt-BR', '--disable-gpu', '--hidden', 'bomb-farm://open']),
    ).toBeNull();
    expect(findForbiddenDebugSwitch([EXE])).toBeNull();
    expect(findForbiddenDebugSwitch([])).toBeNull();
  });

  it('does not take a path or a value that merely contains the word for a switch', () => {
    expect(findForbiddenDebugSwitch(['C:\\tools\\inspect\\app.exe', '--note=inspect'])).toBeNull();
  });
});

describe('refuseDebugSwitchesWhenPackaged', () => {
  function run(isPackaged: boolean, argv: readonly string[]) {
    const exits: number[] = [];
    const lines: string[] = [];
    const refused = refuseDebugSwitchesWhenPackaged({
      isPackaged,
      argv,
      exit: (code) => exits.push(code),
      writeLine: (line) => lines.push(line),
    });
    return { refused, exits, lines };
  }

  it('exits with code 1 and names the switch when packaged', () => {
    const { refused, exits, lines } = run(true, [EXE, '--remote-debugging-port=9222']);
    expect(refused).toBe(true);
    expect(exits).toEqual([1]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('--remote-debugging-port=9222');
  });

  it('does nothing unpackaged, where Playwright and the dev scripts pass these switches on purpose', () => {
    const { refused, exits, lines } = run(false, [EXE, '--inspect=0', '--remote-debugging-port=0']);
    expect(refused).toBe(false);
    expect(exits).toEqual([]);
    expect(lines).toEqual([]);
  });

  it('does nothing when packaged with clean arguments', () => {
    const { refused, exits } = run(true, [EXE, '--lang=en']);
    expect(refused).toBe(false);
    expect(exits).toEqual([]);
  });
});

describe('the main entry', () => {
  const source = readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf8');

  it('refuses debugging switches before it resolves its environment, registers a scheme or touches the app identity', () => {
    const guardAt = source.indexOf('refuseDebugSwitchesWhenPackaged({');
    expect(guardAt).toBeGreaterThan(-1);
    for (const later of ['const env = resolveBootEnv()', 'registerRendererSchemeAsPrivileged();', 'applyAppIdentity(app', 'app.whenReady()']) {
      const laterAt = source.indexOf(later);
      expect(laterAt, later).toBeGreaterThan(-1);
      expect(guardAt, later).toBeLessThan(laterAt);
    }
  });

  it('ends the process with app.exit, not a graceful quit', () => {
    const guardAt = source.indexOf('refuseDebugSwitchesWhenPackaged({');
    const guardCall = source.slice(guardAt, source.indexOf('});', guardAt));
    expect(guardCall).toContain('app.exit(');
    expect(guardCall).not.toContain('app.quit');
  });
});
