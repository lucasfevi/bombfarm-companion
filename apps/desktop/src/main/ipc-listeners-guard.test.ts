import { relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { guardScanner } from './guard-scan';

const SRC_ROOT = resolve(__dirname, '..');
const { readAll } = guardScanner(__filename);

const REGISTERING_METHODS: ReadonlySet<string> = new Set([
  'on',
  'once',
  'handle',
  'handleOnce',
  'addListener',
  'prependListener',
  'prependOnceListener',
]);
const REMOVING_METHODS: ReadonlySet<string> = new Set(['removeHandler', 'removeListener', 'removeAllListeners', 'off']);

interface IpcRegistration {
  readonly channel: string;
  readonly handler: ts.Expression | undefined;
}

interface IpcUse {
  readonly registrations: IpcRegistration[];
  readonly violations: string[];
}

function isIpcSurface(node: ts.Node): boolean {
  if (ts.isIdentifier(node)) return node.text === 'ipcMain';
  return ts.isPropertyAccessExpression(node) && node.name.text === 'ipc';
}

function describeNode(node: ts.Node, sourceFile: ts.SourceFile): string {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `line ${String(line + 1)}: ${node.getText(sourceFile).slice(0, 80)}`;
}

function isDirectMethodCallTarget(node: ts.Node): boolean {
  const access = node.parent;
  return (
    ts.isPropertyAccessExpression(access) &&
    access.expression === node &&
    ts.isCallExpression(access.parent) &&
    access.parent.expression === access
  );
}

export function findIpcUse(source: string): IpcUse {
  const sourceFile = ts.createSourceFile('scanned.ts', source, ts.ScriptTarget.Latest, true);
  const registrations: IpcRegistration[] = [];
  const violations: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isImportSpecifier(node) && (node.propertyName ?? node.name).text === 'ipcMain') {
      if (node.propertyName !== undefined && node.propertyName.text !== node.name.text) {
        violations.push(`aliased import of ipcMain, ${describeNode(node, sourceFile)}`);
      }
    } else if (ts.isPropertyAccessExpression(node) && node.name.text === 'ipcMain') {
      violations.push(`ipcMain reached through a property access, ${describeNode(node, sourceFile)}`);
    } else if (ts.isElementAccessExpression(node) && /ipcMain|ipc/.test(node.argumentExpression.getText(sourceFile))) {
      violations.push(`ipc surface reached through an element access, ${describeNode(node, sourceFile)}`);
    } else if (isIpcSurface(node) && !ts.isImportSpecifier(node.parent) && !isDirectMethodCallTarget(node)) {
      if (!(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)) {
        violations.push(`ipc surface used other than as a direct method call, ${describeNode(node, sourceFile)}`);
      }
    }

    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      isIpcSurface(node.expression.expression)
    ) {
      const method = node.expression.name.text;
      const [channel, handler] = node.arguments;
      if (REGISTERING_METHODS.has(method)) {
        if (channel !== undefined && (ts.isStringLiteral(channel) || ts.isNoSubstitutionTemplateLiteral(channel))) {
          registrations.push({ channel: channel.text, handler });
        } else {
          violations.push(`registration whose channel is not a string literal, ${describeNode(node, sourceFile)}`);
        }
      } else if (!REMOVING_METHODS.has(method)) {
        violations.push(`unrecognised ipc method ${method}, ${describeNode(node, sourceFile)}`);
      }
    }

    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return { registrations, violations };
}

function calleeName(expression: ts.Expression | undefined): string | null {
  return expression !== undefined && ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)
    ? expression.expression.text
    : null;
}

function factoryArguments(expression: ts.Expression | undefined): Record<string, string> {
  const options = expression !== undefined && ts.isCallExpression(expression) ? expression.arguments[0] : undefined;
  if (options === undefined || !ts.isObjectLiteralExpression(options)) return {};
  const described: Record<string, string> = {};
  for (const property of options.properties) {
    if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) continue;
    const value = ts.isPropertyAssignment(property) ? property.initializer : property.name;
    described[property.name.getText()] = ts.isCallExpression(value) && value.arguments.length > 0
      ? (ts.isIdentifier(value.expression) ? value.expression.text : value.getText())
      : value.getText();
  }
  return described;
}

describe('main-process IPC listeners we own', () => {
  const uses = readAll(SRC_ROOT, ['.ts', '.tsx'])
    .map((file) => ({
      file: relative(SRC_ROOT, file.path).split('\\').join('/'),
      use: findIpcUse(file.source),
    }))
    .filter((entry) => entry.use.registrations.length > 0 || entry.use.violations.length > 0);

  it('is one handler, the bridge, registered in index.ts, with nothing the scan cannot read', () => {
    expect(uses.flatMap((entry) => entry.use.violations.map((violation) => `${entry.file}: ${violation}`))).toEqual([]);
    expect(uses.map((entry) => [entry.file, entry.use.registrations.map((registration) => registration.channel)])).toEqual([
      ['main/index.ts', ['bfc:invoke']],
    ]);
  });

  it('builds the bridge handler through the sender-checking factory', () => {
    const handler = uses.find((entry) => entry.file === 'main/index.ts')?.use.registrations[0]?.handler;
    expect(calleeName(handler)).toBe('createBridgeInvokeHandler');
  });

  it('feeds the factory the resolved environment, the dev renderer URL, the real dispatch and the log', () => {
    const handler = uses.find((entry) => entry.file === 'main/index.ts')?.use.registrations[0]?.handler;
    expect(factoryArguments(handler)).toEqual({
      env: 'resolveAppEnv()',
      devRendererUrl: 'RENDERER_DEV_URL',
      senderWindowOf: 'createSenderWindowResolver',
      dispatch: 'dispatch',
      log: 'log',
    });
  });
});

describe('findIpcUse', () => {
  const registered = (source: string) => findIpcUse(source).registrations.map((registration) => registration.channel);
  const violated = (source: string) => findIpcUse(source).violations.length;

  it('reads a literal registration through ipcMain and through a webContents', () => {
    expect(registered("ipcMain.handle('a', handler);")).toEqual(['a']);
    expect(registered('ipcMain.handle(`b`, handler);')).toEqual(['b']);
    expect(registered("win.webContents.ipc.handle('c', handler);")).toEqual(['c']);
  });

  it('reads every registering method', () => {
    for (const method of ['on', 'once', 'handle', 'handleOnce', 'addListener', 'prependListener', 'prependOnceListener']) {
      expect(registered(`ipcMain.${method}('x', handler);`), method).toEqual(['x']);
    }
  });

  it('flags a channel that is not a string literal', () => {
    expect(violated('ipcMain.handle(CHANNEL, handler);')).toBe(1);
    expect(violated("ipcMain.handle(`a${name}`, handler);")).toBe(1);
    expect(violated("ipcMain.handle('a' + b, handler);")).toBe(1);
    expect(violated('win.webContents.ipc.on(channelName, handler);')).toBe(1);
    expect(violated('ipcMain.prependListener(CHANNEL, handler);')).toBe(1);
  });

  it('flags an aliased, destructured, reassigned or property-reached ipcMain', () => {
    expect(violated("import { ipcMain as bus } from 'electron';")).toBe(1);
    expect(violated('const { handle } = ipcMain;')).toBe(1);
    expect(violated('const bus = ipcMain; bus.handle(CHANNEL, handler);')).toBeGreaterThan(0);
    expect(violated("electron.ipcMain.handle('a', handler);")).toBeGreaterThan(0);
    expect(violated("require('electron').ipcMain.handle('a', handler);")).toBeGreaterThan(0);
    expect(violated("electron['ipcMain'].handle('a', handler);")).toBeGreaterThan(0);
    expect(violated('register(ipcMain);')).toBe(1);
  });

  it('flags a method it does not recognise', () => {
    expect(violated("ipcMain.emit('a');")).toBe(1);
  });

  it('accepts the plain import and the removing methods', () => {
    expect(violated("import { ipcMain } from 'electron';")).toBe(0);
    expect(violated("ipcMain.removeHandler('a');")).toBe(0);
  });

  it('ignores ipcMain named only in a comment or a string', () => {
    expect(violated("// ipcMain.handle(CHANNEL, handler)\nconst text = 'ipcMain.handle(CHANNEL)';")).toBe(0);
  });
});
