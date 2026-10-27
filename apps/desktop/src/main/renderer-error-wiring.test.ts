import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/** A gate given a clock of its own is a gate the app cannot be sure refills: `now: () => 0` never
 *  does, and nothing else would notice. The app builds it with its default monotonic clock. */
function gateCallsIn(source: string, factory = 'createRendererErrorGate'): ts.CallExpression[] {
  const file = ts.createSourceFile('fixture.ts', source, ts.ScriptTarget.Latest, true);
  const calls: ts.CallExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === factory) {
      calls.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return calls;
}

function optionNames(call: ts.CallExpression): string[] | null {
  const [options] = call.arguments;
  if (options === undefined || !ts.isObjectLiteralExpression(options)) return null;
  return options.properties.map((property) =>
    ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) ? property.name.text : `<${ts.SyntaxKind[property.kind]}>`,
  );
}

describe('how the app builds the renderer-error gate', () => {
  const source = readFileSync(resolve(__dirname, 'index.ts'), 'utf8');

  it('builds exactly one, from the log alone, so it runs on its default monotonic clock', () => {
    const calls = gateCallsIn(source);
    expect(calls).toHaveLength(1);
    expect(optionNames(calls[0] as ts.CallExpression)).toEqual(['warn']);
  });

  it('builds the rejection log gate the same way', () => {
    const calls = gateCallsIn(source, 'createIpcRejectionLogGate');
    expect(calls).toHaveLength(1);
    expect(optionNames(calls[0] as ts.CallExpression)).toEqual(['warn']);
  });
});

interface IpcMainCall {
  readonly method: string;
  readonly channel: string | null;
  readonly position: number;
}

function ipcMainCallsIn(functionName: string, source: string): IpcMainCall[] {
  const file = ts.createSourceFile('fixture.ts', source, ts.ScriptTarget.Latest, true);
  const calls: IpcMainCall[] = [];
  const visitBody = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'ipcMain'
    ) {
      const [channel] = node.arguments;
      calls.push({
        method: node.expression.name.text,
        channel: channel !== undefined && ts.isStringLiteral(channel) ? channel.text : null,
        position: node.getStart(file),
      });
    }
    ts.forEachChild(node, visitBody);
  };
  file.forEachChild(function find(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === functionName && node.body) visitBody(node.body);
  });
  return calls.sort((a, b) => a.position - b.position);
}

function removalsBeforeBridge(calls: readonly IpcMainCall[]): { removeAll: boolean; removeHandler: boolean } {
  const bridge = calls.find((call) => call.method === 'handle' && call.channel === 'bfc:invoke');
  const before = calls.filter((call) => bridge !== undefined && call.position < bridge.position);
  const removes = (method: string): boolean =>
    before.some((call) => call.method === method && call.channel === '__ELECTRON_LOG__');
  return { removeAll: removes('removeAllListeners'), removeHandler: removes('removeHandler') };
}

describe('electron-log own IPC entry points', () => {
  const source = readFileSync(resolve(__dirname, 'index.ts'), 'utf8');

  it('are removed, the listener and the handler, before the bridge handler is registered', () => {
    const calls = ipcMainCallsIn('registerIpcHandlers', source);
    expect(calls.some((call) => call.method === 'handle' && call.channel === 'bfc:invoke')).toBe(true);
    expect(removalsBeforeBridge(calls)).toEqual({ removeAll: true, removeHandler: true });
  });
});

describe('removalsBeforeBridge', () => {
  const wrap = (body: string) => `function registerIpcHandlers() { ${body} }`;
  const bridge = "ipcMain.handle('bfc:invoke', handler);";

  it('sees both removals when they come first', () => {
    const body = `ipcMain.removeAllListeners('__ELECTRON_LOG__'); ipcMain.removeHandler('__ELECTRON_LOG__'); ${bridge}`;
    expect(removalsBeforeBridge(ipcMainCallsIn('registerIpcHandlers', wrap(body)))).toEqual({
      removeAll: true,
      removeHandler: true,
    });
  });

  it('red state: nothing removed', () => {
    expect(removalsBeforeBridge(ipcMainCallsIn('registerIpcHandlers', wrap(bridge)))).toEqual({
      removeAll: false,
      removeHandler: false,
    });
  });

  it('red state: one removal only, or a removal of some other channel', () => {
    const body = `ipcMain.removeAllListeners('__ELECTRON_LOG__'); ipcMain.removeHandler('other'); ${bridge}`;
    expect(removalsBeforeBridge(ipcMainCallsIn('registerIpcHandlers', wrap(body)))).toEqual({
      removeAll: true,
      removeHandler: false,
    });
  });

  it('red state: removals that come after the bridge handler is registered', () => {
    const body = `${bridge} ipcMain.removeAllListeners('__ELECTRON_LOG__'); ipcMain.removeHandler('__ELECTRON_LOG__');`;
    expect(removalsBeforeBridge(ipcMainCallsIn('registerIpcHandlers', wrap(body)))).toEqual({
      removeAll: false,
      removeHandler: false,
    });
  });

  it('red state: removals in some other function', () => {
    const source = `function elsewhere() { ipcMain.removeAllListeners('__ELECTRON_LOG__'); } ${wrap(bridge)}`;
    expect(removalsBeforeBridge(ipcMainCallsIn('registerIpcHandlers', source)).removeAll).toBe(false);
  });
});

describe('gateCallsIn', () => {
  it('reads the option names of the call, comment text ignored', () => {
    const calls = gateCallsIn('// createRendererErrorGate({ now })\nconst g = createRendererErrorGate({ now: () => 0, warn: log });');
    expect(calls).toHaveLength(1);
    expect(optionNames(calls[0] as ts.CallExpression)).toEqual(['now', 'warn']);
  });

  it('names a spread or a shorthand it cannot read, rather than passing it', () => {
    const [call] = gateCallsIn('createRendererErrorGate({ ...rest, warn });');
    expect(optionNames(call as ts.CallExpression)).toEqual(['<SpreadAssignment>', '<ShorthandPropertyAssignment>']);
  });

  it('returns null for a call with no literal options', () => {
    const [call] = gateCallsIn('createRendererErrorGate(options);');
    expect(optionNames(call as ts.CallExpression)).toBeNull();
  });
});
