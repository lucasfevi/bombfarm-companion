import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { guardScanner } from './guard-scan';

const MAIN_ROOT = resolve(__dirname, '..');
const LISTENER_REGISTRATION =
  /\b(?:ipcMain|\w*\.ipc)\s*\.\s*(?:on|once|handle|handleOnce|addListener)\s*\(\s*(['"`])([^'"`]*)\1\s*,\s*(\([^)]*\)|\w+)/g;

const { readAll } = guardScanner(__filename);

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function listenersIn(source: string): { channel: string; parameters: string }[] {
  return [...stripComments(source).matchAll(LISTENER_REGISTRATION)].map((match) => ({
    channel: match[2] as string,
    parameters: match[3] as string,
  }));
}

describe('main-process IPC listeners we own', () => {
  const owners = readAll(MAIN_ROOT, ['.ts'])
    .map((file) => ({ file: relative(MAIN_ROOT, file.path).split('\\').join('/'), listeners: listenersIn(file.source), source: file.source }))
    .filter((entry) => entry.listeners.length > 0);

  it('is one handler, the bridge, registered in index.ts', () => {
    expect(owners.map((entry) => [entry.file, entry.listeners.map((listener) => listener.channel)])).toEqual([
      ['main/index.ts', ['bfc:invoke']],
    ]);
  });

  it('receives the event, and the bridge handler runs the sender policy before dispatching', () => {
    const index = owners.find((entry) => entry.file === 'main/index.ts');
    const handler = index?.listeners[0];
    expect(handler?.parameters.startsWith('(event')).toBe(true);

    const body = stripComments(index?.source ?? '').split("ipcMain.handle('bfc:invoke'")[1] ?? '';
    const policyAt = body.indexOf('decideIpcSender(');
    const dispatchAt = body.indexOf('dispatch(channel');
    expect(policyAt).toBeGreaterThan(-1);
    expect(dispatchAt).toBeGreaterThan(policyAt);
  });
});

describe('listenersIn', () => {
  it('reads each registration style and its first parameter', () => {
    const source = [
      "ipcMain.handle('a', (event, x) => x);",
      "ipcMain.on('b', (_event, y) => y);",
      "ipcMain.once('c', handler);",
      "win.webContents.ipc.handle('d', (event) => 1);",
    ].join('\n');
    expect(listenersIn(source)).toEqual([
      { channel: 'a', parameters: '(event, x)' },
      { channel: 'b', parameters: '(_event, y)' },
      { channel: 'c', parameters: 'handler' },
      { channel: 'd', parameters: '(event)' },
    ]);
  });

  it('ignores a registration that only appears in a comment', () => {
    expect(listenersIn("// ipcMain.handle('a', (event) => 1)")).toEqual([]);
  });
});
