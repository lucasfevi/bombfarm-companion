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

interface ReadOptions {
  readonly members: Record<string, ts.Expression>;
  readonly violations: string[];
}

function readOptions(options: ts.Node | undefined, label: string): ReadOptions {
  const members: Record<string, ts.Expression> = {};
  const violations: string[] = [];
  if (options === undefined || !ts.isObjectLiteralExpression(options)) {
    return { members, violations: [`${label}: options are not an object literal`] };
  }
  for (const member of options.properties) {
    let key: string;
    let value: ts.Expression;
    if (ts.isShorthandPropertyAssignment(member)) {
      key = member.name.text;
      value = member.name;
    } else if (ts.isPropertyAssignment(member) && (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name))) {
      key = member.name.text;
      value = member.initializer;
    } else {
      violations.push(`${label}: member that is not a plain property: ${member.getText().slice(0, 60)}`);
      continue;
    }
    if (Object.hasOwn(members, key)) {
      violations.push(`${label}: duplicate key ${key}`);
    }
    members[key] = value;
  }
  return { members, violations };
}

function describeValue(value: ts.Expression): string {
  return ts.isCallExpression(value) && value.arguments.length > 0 && ts.isIdentifier(value.expression)
    ? value.expression.text
    : value.getText();
}

function describeAll(members: Record<string, ts.Expression>): Record<string, string> {
  return Object.fromEntries(Object.entries(members).map(([key, value]) => [key, describeValue(value)]));
}

interface FactoryPin {
  readonly violations: string[];
  readonly factory: Record<string, string>;
  readonly resolver: Record<string, string>;
}

function pinFactory(handler: ts.Expression | undefined): FactoryPin {
  const factoryCall = handler !== undefined && ts.isCallExpression(handler) ? handler : undefined;
  const factory = readOptions(factoryCall?.arguments[0], 'factory');
  const resolverValue = factory.members.senderWindowOf;
  const resolverCall = resolverValue !== undefined && ts.isCallExpression(resolverValue) ? resolverValue : undefined;
  const resolver = readOptions(resolverCall?.arguments[0], 'resolver');
  return {
    violations: [...factory.violations, ...resolver.violations],
    factory: describeAll(factory.members),
    resolver: describeAll(resolver.members),
  };
}

function firstExpression(source: string): ts.Expression | undefined {
  const sourceFile = ts.createSourceFile('fixture.ts', source, ts.ScriptTarget.Latest, true);
  const statement = sourceFile.statements[0];
  return statement !== undefined && ts.isExpressionStatement(statement) ? statement.expression : undefined;
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
    expect(pinFactory(handler)).toEqual(PINNED);
  });
});

const PINNED: FactoryPin = {
  violations: [],
  factory: {
    env: 'resolveAppEnv()',
    devRendererUrl: 'RENDERER_DEV_URL',
    senderWindowOf: 'createSenderWindowResolver',
    dispatch: 'dispatch',
    log: 'log',
  },
  resolver: { main: 'liveMainContents', mini: 'liveMiniContents' },
};

describe('pinFactory', () => {
  const pinned = (source: string) => pinFactory(firstExpression(source));
  const wrap = (members: string, resolverMembers = 'main: liveMainContents, mini: liveMiniContents') =>
    `createBridgeInvokeHandler({ ${members}, senderWindowOf: createSenderWindowResolver({ ${resolverMembers} }) });`;
  const CLEAN = 'env: resolveAppEnv(), devRendererUrl: RENDERER_DEV_URL, dispatch, log';

  it('reads the clean shape the app uses', () => {
    expect(pinned(wrap(CLEAN))).toEqual(PINNED);
  });

  it('flags a spread appended to the factory options', () => {
    const result = pinned(wrap(`${CLEAN}, ...{ env: { isDev: true } }`));
    expect(result.violations).toHaveLength(1);
    expect(result).not.toEqual(PINNED);
  });

  it('flags a duplicate key that would override an earlier one', () => {
    const result = pinned(wrap(`${CLEAN}, env: { isDev: true }`));
    expect(result.violations).toEqual(['factory: duplicate key env']);
  });

  it('flags a computed key, a method, a getter and a string-keyed duplicate', () => {
    expect(pinned(wrap(`${CLEAN}, ['env']: other`)).violations).toHaveLength(1);
    expect(pinned(wrap(`${CLEAN}, env() { return other; }`)).violations.length).toBeGreaterThan(0);
    expect(pinned(wrap(`${CLEAN}, get env() { return other; }`)).violations.length).toBeGreaterThan(0);
    expect(pinned(wrap(`${CLEAN}, 'env': other`)).violations).toEqual(['factory: duplicate key env']);
  });

  it('flags factory options that are not an object literal', () => {
    expect(pinned('createBridgeInvokeHandler(options);').violations).toEqual([
      'factory: options are not an object literal',
      'resolver: options are not an object literal',
    ]);
  });

  it('flags a wrong resolver getter', () => {
    const result = pinned(wrap(CLEAN, 'main: liveMiniContents, mini: liveMiniContents'));
    expect(result.violations).toEqual([]);
    expect(result).not.toEqual(PINNED);
  });

  it('flags a spread, a duplicate and a computed key among the resolver getters', () => {
    expect(pinned(wrap(CLEAN, 'main: liveMainContents, mini: liveMiniContents, ...other')).violations).toHaveLength(1);
    expect(pinned(wrap(CLEAN, 'main: liveMainContents, mini: liveMiniContents, main: other')).violations).toEqual([
      'resolver: duplicate key main',
    ]);
    expect(pinned(wrap(CLEAN, 'main: liveMainContents, mini: liveMiniContents, [key]: other')).violations).toHaveLength(1);
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
