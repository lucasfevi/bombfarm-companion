import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  findForbiddenDebugSwitch,
  refuseDebugSwitchesOfPackagedApp,
  refuseDebugSwitchesWhenPackaged,
} from './debug-switch-guard.js';

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

  it('leaves alone a switch whose name only contains the word mid-name', () => {
    expect(findForbiddenDebugSwitch([EXE, '--no-inspect'])).toBeNull();
    expect(findForbiddenDebugSwitch([EXE, '--enable-remote-debugging-port=1'])).toBeNull();
    expect(findForbiddenDebugSwitch([EXE, '--my-js-flags=x'])).toBeNull();
    expect(findForbiddenDebugSwitch([EXE, '--disable-remote-allow-origins'])).toBeNull();
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

  const CALL = 'refuseDebugSwitchesOfPackagedApp(app, process);';
  const tree = ts.createSourceFile('index.ts', source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  const lastImportIndex = tree.statements.map((statement) => ts.isImportDeclaration(statement)).lastIndexOf(true);

  it('calls the guard with the real app and process, once', () => {
    expect(source.split(CALL)).toHaveLength(2);
  });

  function statementAt(index: number): ts.Statement {
    const statement = tree.statements[index];
    if (statement === undefined) throw new Error(`no top-level statement at ${String(index)}`);
    return statement;
  }

  it('makes the call the first statement after the last import, bare and at the top level', () => {
    const statement = statementAt(lastImportIndex + 1);
    expect(ts.isExpressionStatement(statement)).toBe(true);
    const expression = (statement as ts.ExpressionStatement).expression;
    expect(expression.getText(tree)).toBe('refuseDebugSwitchesOfPackagedApp(app, process)');
    expect(ts.isCallExpression(expression)).toBe(true);
  });

  it('puts nothing but whitespace and comments between the last import and the call', () => {
    const lastImport = statementAt(lastImportIndex);
    const call = statementAt(lastImportIndex + 1);
    const between = source.slice(lastImport.getEnd(), call.getStart(tree));
    const withoutComments = between.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(withoutComments.trim()).toBe('');
  });

  it('calls it synchronously, ahead of every await, whenReady, scheme registration, identity and environment work', () => {
    const callAt = source.indexOf(CALL);
    const before = source.slice(0, callAt);
    expect(before).not.toMatch(/\bawait\b/);
    expect(before).not.toContain('whenReady');
    expect(before).not.toContain('.then(');
    for (const later of ['const env = resolveBootEnv()', 'registerRendererSchemeAsPrivileged();', 'applyAppIdentity(app', 'app.whenReady()']) {
      const laterAt = source.indexOf(later);
      expect(laterAt, later).toBeGreaterThan(-1);
      expect(callAt, later).toBeLessThan(laterAt);
    }
  });
});

describe('refuseDebugSwitchesOfPackagedApp', () => {
  function run(isPackaged: boolean, argv: readonly string[]) {
    const exits: number[] = [];
    const written: string[] = [];
    const refused = refuseDebugSwitchesOfPackagedApp(
      { isPackaged, exit: (code) => exits.push(code) },
      { argv, stderr: { write: (line) => written.push(line) } },
    );
    return { refused, exits, written };
  }

  it('exits with code 1 through app.exit and writes one line to stderr when packaged with a debugging switch', () => {
    const { refused, exits, written } = run(true, [EXE, '--remote-debugging-port=9222']);
    expect(refused).toBe(true);
    expect(exits).toEqual([1]);
    expect(written).toEqual(['debug_switch.refused --remote-debugging-port=9222\n']);
  });

  it('does not exit unpackaged, whatever the arguments', () => {
    const { refused, exits, written } = run(false, [EXE, '--remote-debugging-port=0', '--inspect=0']);
    expect(refused).toBe(false);
    expect(exits).toEqual([]);
    expect(written).toEqual([]);
  });

  it('does not exit when packaged with a clean argv', () => {
    const { refused, exits, written } = run(true, [EXE, '--lang=en']);
    expect(refused).toBe(false);
    expect(exits).toEqual([]);
    expect(written).toEqual([]);
  });

  it('reads the arguments it is handed, not an empty list', () => {
    expect(run(true, [EXE, '--js-flags=--expose-gc']).refused).toBe(true);
  });
});
