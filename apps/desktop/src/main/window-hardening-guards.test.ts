import { join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { guardScanner } from './guard-scan';

const SRC_ROOT = resolve(__dirname, '..');
const MAIN_INDEX = resolve(__dirname, 'index.ts');
const MINI_LIVE_WINDOW = resolve(__dirname, 'mini-live-window.ts');
const WEB_PREFERENCES_BUILDER = resolve(__dirname, 'web-preferences.ts');
const WINDOW_FILES = [MAIN_INDEX, MINI_LIVE_WINDOW];

const { readAll } = guardScanner(__filename);

const WINDOW_CLASSES = ['BrowserWindow', 'BaseWindow', 'WebContentsView', 'BrowserView'];
const WINDOW_CONSTRUCTORS = [...WINDOW_CLASSES, 'BrowserWindowCtor'];

const SECURITY_KEYS = [
  'sandbox',
  'nodeIntegration',
  'nodeIntegrationInSubFrames',
  'nodeIntegrationInWorker',
  'contextIsolation',
  'webSecurity',
  'allowRunningInsecureContent',
  'webviewTag',
];

const SANDBOX_OFF_SWITCHES = ['no-sandbox', 'disable-gpu-sandbox', 'disable-web-security'];

function parse(source: string): ts.SourceFile {
  return ts.createSourceFile('guarded.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function visit(node: ts.Node, each: (node: ts.Node) => void): void {
  each(node);
  ts.forEachChild(node, (child) => {
    visit(child, each);
  });
}

function nodesOf(source: string): ts.Node[] {
  const nodes: ts.Node[] = [];
  visit(parse(source), (node) => nodes.push(node));
  return nodes;
}

function isElectronSpecifier(text: string): boolean {
  return /^electron(\/.*)?$/.test(text);
}

function stringText(node: ts.Node | undefined): string | undefined {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return undefined;
}

function propertyNameText(name: ts.PropertyName | ts.BindingName | ts.EntityName | undefined): string | undefined {
  if (!name) return undefined;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
    return name.text;
  }
  if (ts.isComputedPropertyName(name)) return stringText(name.expression);
  return undefined;
}

function unwrap(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (ts.isParenthesizedExpression(current) || ts.isNonNullExpression(current) || ts.isAsExpression(current)) {
    current = current.expression;
  }
  return current;
}

function windowImportsFromElectron(source: string): string[] {
  const found: string[] = [];

  const named = (elements: readonly (ts.ImportSpecifier | ts.ExportSpecifier)[]): void => {
    for (const element of elements) {
      if (element.isTypeOnly) continue;
      const imported = (element.propertyName ?? element.name).text;
      if (WINDOW_CLASSES.includes(imported)) found.push(imported);
    }
  };

  for (const node of nodesOf(source)) {
    if (ts.isImportDeclaration(node) && isElectronSpecifier(stringText(node.moduleSpecifier) ?? '')) {
      const clause = node.importClause;
      if (!clause || clause.phaseModifier === ts.SyntaxKind.TypeKeyword) continue;
      if (clause.name) found.push('whole electron module');
      const bindings = clause.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) found.push('whole electron module');
      if (bindings && ts.isNamedImports(bindings)) named(bindings.elements);
    } else if (ts.isExportDeclaration(node) && isElectronSpecifier(stringText(node.moduleSpecifier) ?? '')) {
      if (node.isTypeOnly) continue;
      const exported = node.exportClause;
      if (!exported || ts.isNamespaceExport(exported)) found.push('whole electron module');
      else named(exported.elements);
    } else if (ts.isImportEqualsDeclaration(node) && !node.isTypeOnly) {
      const reference = node.moduleReference;
      if (ts.isExternalModuleReference(reference) && isElectronSpecifier(stringText(reference.expression) ?? '')) {
        found.push('whole electron module');
      }
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const loadsModule =
        callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === 'require');
      if (loadsModule && isElectronSpecifier(stringText(node.arguments[0]) ?? '')) {
        found.push('whole electron module');
      }
    }
  }

  return found;
}

function securityKeyOf(target: ts.Expression): string | undefined {
  const expression = unwrap(target);
  const key = ts.isPropertyAccessExpression(expression)
    ? expression.name.text
    : ts.isElementAccessExpression(expression)
      ? stringText(expression.argumentExpression)
      : undefined;
  return key !== undefined && SECURITY_KEYS.includes(key) ? key : undefined;
}

function mentionsSecurityKey(node: ts.Node): string | undefined {
  let key: string | undefined;
  visit(node, (inner) => {
    if (key !== undefined) return;
    const candidate =
      ts.isPropertyAssignment(inner) || ts.isShorthandPropertyAssignment(inner)
        ? propertyNameText(inner.name)
        : stringText(inner);
    if (candidate !== undefined && SECURITY_KEYS.includes(candidate)) key = candidate;
  });
  return key;
}

function securityPreferenceMutations(source: string): string[] {
  const found: string[] = [];

  for (const node of nodesOf(source)) {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      const key = securityKeyOf(node.left);
      if (key) found.push(key);
    } else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const { expression: owner, name } = node.expression;
      const reflective =
        ts.isIdentifier(owner) &&
        ((owner.text === 'Reflect' && ['set', 'defineProperty'].includes(name.text)) ||
          (owner.text === 'Object' && ['defineProperty', 'defineProperties', 'assign'].includes(name.text)));
      if (!reflective) continue;
      for (const argument of node.arguments) {
        const key = mentionsSecurityKey(argument);
        if (key) found.push(key);
      }
    }
  }

  return found;
}

function configuresWindows(source: string): boolean {
  return nodesOf(source).some(
    (node) =>
      (ts.isIdentifier(node) && node.text === 'webPreferences') ||
      (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && WINDOW_CONSTRUCTORS.includes(node.expression.text)),
  );
}

function securityKeysSpelledInObjectLiterals(source: string): string[] {
  const found: string[] = [];
  for (const node of nodesOf(source)) {
    if (!ts.isObjectLiteralExpression(node)) continue;
    for (const property of node.properties) {
      if (ts.isSpreadAssignment(property)) continue;
      const name = propertyNameText(property.name);
      if (name !== undefined && SECURITY_KEYS.includes(name)) found.push(name);
    }
  }
  return found;
}

function sandboxOffSwitchesIn(source: string): string[] {
  const found: string[] = [];
  for (const node of nodesOf(source)) {
    const text =
      ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateLiteralToken(node)
        ? node.text
        : undefined;
    if (text === undefined) continue;
    for (const flag of SANDBOX_OFF_SWITCHES) if (text.includes(flag)) found.push(flag);
  }
  return found;
}

function otherHostsIn(source: string): string[] {
  const found: string[] = [];
  for (const node of nodesOf(source)) {
    if (ts.isIdentifier(node) && ['BrowserView', 'WebContentsView', 'BaseWindow'].includes(node.text)) {
      found.push(node.text);
    } else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && /<webview\b/.test(node.text)) {
      found.push('<webview');
    }
  }
  return found;
}

function createsWindows(source: string): boolean {
  return nodesOf(source).some(
    (node) => ts.isNewExpression(node) && ts.isIdentifier(node.expression) && WINDOW_CONSTRUCTORS.includes(node.expression.text),
  );
}

function webPreferencesNotFromSandboxedBuilder(source: string): number {
  let offenders = 0;
  for (const node of nodesOf(source)) {
    const isName =
      ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
    if (!isName || node.text !== 'webPreferences') continue;
    const parent = node.parent;
    const sanctioned =
      ts.isPropertyAssignment(parent) &&
      parent.name === node &&
      ts.isCallExpression(parent.initializer) &&
      ts.isIdentifier(parent.initializer.expression) &&
      parent.initializer.expression.text === 'sandboxedWebPreferences';
    if (!sanctioned) offenders += 1;
  }
  return offenders;
}

function isCallOf(node: ts.Node, owner: string, member: string): node is ts.CallExpression {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === owner &&
    node.expression.name.text === member
  );
}

type SandboxPlacement = 'ok' | 'missing' | 'repeated' | 'not a top-level statement' | 'after whenReady';

function enableSandboxPlacement(source: string): SandboxPlacement {
  const file = parse(source);
  const calls = nodesOf(source).filter(
    (node): node is ts.CallExpression =>
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'enableSandbox',
  );
  if (calls.length === 0) return 'missing';
  if (calls.length > 1) return 'repeated';

  const topLevel = file.statements.find(
    (statement) =>
      ts.isExpressionStatement(statement) &&
      isCallOf(statement.expression, 'app', 'enableSandbox') &&
      statement.expression.arguments.length === 0,
  );
  if (!topLevel) return 'not a top-level statement';

  const firstReady = nodesOf(source).find(
    (node) => ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'whenReady',
  );
  if (!firstReady || firstReady.getStart(file) < topLevel.getStart(file)) return 'after whenReady';

  return 'ok';
}

describe('renderer windows stay sandboxed', () => {
  const sources = readAll(SRC_ROOT, ['.ts']);
  const named = (read: (source: string) => unknown[], only?: (path: string) => boolean) =>
    sources
      .filter((file) => (only ? only(file.path) : true))
      .map((file) => ({ file: relative(SRC_ROOT, file.path), found: read(file.source) }))
      .filter((entry) => entry.found.length > 0);

  it('scans the main and preload trees', () => {
    expect(sources.length).toBeGreaterThanOrEqual(90);
  });

  it('passes no switch that turns the sandbox or web security off', () => {
    expect(named(sandboxOffSwitchesIn)).toEqual([]);
  });

  it('spells no security preference key in a file that configures windows, except the builder', () => {
    const offenders = named(
      securityKeysSpelledInObjectLiterals,
      (path) => path !== WEB_PREFERENCES_BUILDER && configuresWindows(sources.find((file) => file.path === path)?.source ?? ''),
    );

    expect(offenders).toEqual([]);
  });

  it('builds every window\'s web preferences from sandboxedWebPreferences', () => {
    const offenders = sources
      .filter((file) => webPreferencesNotFromSandboxedBuilder(file.source) > 0)
      .map((file) => relative(SRC_ROOT, file.path));

    expect(offenders).toEqual([]);
  });

  it('gives both windows that builder', () => {
    const byPath = new Map(sources.map((file) => [file.path, file.source]));

    for (const path of WINDOW_FILES) {
      const source = byPath.get(path) ?? '';
      expect(configuresWindows(source), relative(SRC_ROOT, path)).toBe(true);
      expect(webPreferencesNotFromSandboxedBuilder(source), relative(SRC_ROOT, path)).toBe(0);
    }
  });

  it('opens windows only from the two files that hand them the builder', () => {
    const creators = sources
      .filter((file) => createsWindows(file.source))
      .map((file) => file.path)
      .sort();

    expect(creators).toEqual([...WINDOW_FILES].sort());
  });

  it('hosts no web content in a view, webview or base window Electron would not sandbox the same way', () => {
    expect(named(otherHostsIn)).toEqual([]);
  });

  it('value-imports a window class, or the whole electron module, in no file but the two that build windows', () => {
    expect(named(windowImportsFromElectron, (path) => !WINDOW_FILES.includes(path))).toEqual([]);
  });

  it('assigns, defines or reflects no security preference anywhere', () => {
    expect(named(securityPreferenceMutations)).toEqual([]);
  });

  it('asks Electron to sandbox every renderer from a top-level statement of the main entry, before the app is ready', () => {
    const source = sources.find((file) => file.path === MAIN_INDEX)?.source ?? '';

    expect(enableSandboxPlacement(source)).toBe('ok');
  });

  it('spells the security keys in the builder, so the scan above reaches the one file that must', () => {
    const builder = sources.find((file) => file.path === WEB_PREFERENCES_BUILDER)?.source ?? '';

    expect(securityKeysSpelledInObjectLiterals(builder).sort()).toEqual(
      ['contextIsolation', 'nodeIntegration', 'sandbox'].sort(),
    );
    expect(join('main', 'web-preferences.ts')).toBe(relative(SRC_ROOT, WEB_PREFERENCES_BUILDER));
  });

  describe('red state demonstrated', () => {
    it('an aliased window import is caught, in any electron entry point, and a type-only one is not', () => {
      expect(windowImportsFromElectron("import { BrowserWindow as BW } from 'electron';")).toEqual(['BrowserWindow']);
      expect(windowImportsFromElectron("import { BrowserWindow as BW } from 'electron/main';")).toEqual(['BrowserWindow']);
      expect(windowImportsFromElectron("import { app, type BaseWindow, WebContentsView } from 'electron';")).toEqual([
        'WebContentsView',
      ]);
      expect(windowImportsFromElectron("import type { BrowserWindow } from 'electron';")).toEqual([]);
      expect(windowImportsFromElectron("import { app, net } from 'electron';")).toEqual([]);
    });

    it('reaching the classes through the whole module, a re-export or a load is caught', () => {
      expect(windowImportsFromElectron("import * as e from 'electron';")).toEqual(['whole electron module']);
      expect(windowImportsFromElectron("import electron from 'electron/main';")).toEqual(['whole electron module']);
      expect(windowImportsFromElectron("const e = require('electron');")).toEqual(['whole electron module']);
      expect(windowImportsFromElectron("const e = await import('electron/main');")).toEqual(['whole electron module']);
      expect(windowImportsFromElectron("import e = require('electron');")).toEqual(['whole electron module']);
      expect(windowImportsFromElectron("export { BaseWindow } from 'electron';")).toEqual(['BaseWindow']);
      expect(windowImportsFromElectron("import {\n  app,\n  BrowserWindow as BW,\n} from 'electron';")).toEqual([
        'BrowserWindow',
      ]);
    });

    it('assigning a security preference is caught, however it is spelled', () => {
      expect(securityPreferenceMutations('webPreferences.sandbox = !true;')).toEqual(['sandbox']);
      expect(securityPreferenceMutations("prefs['nodeIntegration'] = flag;")).toEqual(['nodeIntegration']);
      expect(securityPreferenceMutations('prefs.contextIsolation &&= other;')).toEqual(['contextIsolation']);
      expect(securityPreferenceMutations('(prefs as Loose).webSecurity = false;')).toEqual(['webSecurity']);
      expect(securityPreferenceMutations('if (prefs.sandbox === true) {}')).toEqual([]);
    });

    it('Reflect, Object.defineProperty and Object.assign naming a security preference are caught', () => {
      expect(securityPreferenceMutations("Reflect.set(prefs, 'sandbox', false);")).toEqual(['sandbox']);
      expect(securityPreferenceMutations("Object.defineProperty(prefs, 'nodeIntegration', { value: true });")).toEqual([
        'nodeIntegration',
      ]);
      expect(securityPreferenceMutations('Object.assign(prefs, { contextIsolation: false });')).toEqual([
        'contextIsolation',
      ]);
      expect(securityPreferenceMutations("Object.assign(prefs, { preload: 'x' });")).toEqual([]);
    });

    it('a security key spelled in an object literal is caught, whatever value it holds', () => {
      expect(securityKeysSpelledInObjectLiterals('const a = { sandbox: !true };')).toEqual(['sandbox']);
      expect(
        securityKeysSpelledInObjectLiterals('const a = { ...sandboxedWebPreferences(p), nodeIntegration: x };'),
      ).toEqual(['nodeIntegration']);
      expect(securityKeysSpelledInObjectLiterals("const a = { 'webSecurity': false, [`sandbox`]: 0 };")).toEqual([
        'webSecurity',
        'sandbox',
      ]);
      expect(securityKeysSpelledInObjectLiterals('sandboxedWebPreferences(p)')).toEqual([]);
    });

    it('an unrelated sandbox key is not held against a file that configures no window', () => {
      const unrelated = 'export const policy = { sandbox: 1 };';

      expect(configuresWindows(unrelated)).toBe(false);
      expect(configuresWindows('const w = { webPreferences: { sandbox: 1 } };')).toBe(true);
    });

    it('shorthand and non-builder web preferences are caught', () => {
      expect(webPreferencesNotFromSandboxedBuilder('new BW({ webPreferences })')).toBe(1);
      expect(webPreferencesNotFromSandboxedBuilder('new BW({ webPreferences: { preload } })')).toBe(1);
      expect(webPreferencesNotFromSandboxedBuilder('win.webPreferences = x;')).toBe(1);
      expect(webPreferencesNotFromSandboxedBuilder('new BW({ webPreferences: sandboxedWebPreferences(p) })')).toBe(0);
    });

    it('a // inside a string literal hides nothing on the rest of its line', () => {
      const hiding = "const home = 'https://example.test'; prefs.sandbox = false; Reflect.set(p, 'nodeIntegration', 1);";

      expect(securityPreferenceMutations(hiding)).toEqual(['sandbox', 'nodeIntegration']);
      expect(windowImportsFromElectron("const u = 'https://x.test'; import { BrowserWindow as BW } from 'electron';")).toEqual([
        'BrowserWindow',
      ]);
    });

    it('a weakening named only in a comment is not a finding', () => {
      expect(securityPreferenceMutations('// prefs.sandbox = false would break the preload\nconst x = 1;')).toEqual([]);
      expect(securityKeysSpelledInObjectLiterals('/* { sandbox: false } */ const x = 1;')).toEqual([]);
    });

    it('each sandbox-off switch is caught, in a string and not in a comment', () => {
      expect(sandboxOffSwitchesIn("app.commandLine.appendSwitch('no-sandbox');")).toEqual(['no-sandbox']);
      expect(sandboxOffSwitchesIn("args: ['--no-sandbox']")).toEqual(['no-sandbox']);
      expect(sandboxOffSwitchesIn("appendSwitch('disable-gpu-sandbox')")).toEqual(['disable-gpu-sandbox']);
      expect(sandboxOffSwitchesIn("appendSwitch('disable-web-security')")).toEqual(['disable-web-security']);
      expect(sandboxOffSwitchesIn('// no-sandbox')).toEqual([]);
    });

    it('a view, base window or webview is caught', () => {
      expect(otherHostsIn('new WebContentsView({})')).toEqual(['WebContentsView']);
      expect(otherHostsIn('new BaseWindow({})')).toEqual(['BaseWindow']);
      expect(otherHostsIn("const html = '<webview src=\"x\"></webview>';")).toEqual(['<webview']);
    });

    it('enableSandbox is accepted only as a top-level statement ahead of whenReady', () => {
      const topLevel = 'app.enableSandbox();\napp.whenReady();';

      expect(enableSandboxPlacement(topLevel)).toBe('ok');
      expect(enableSandboxPlacement('async function bootstrap() {\napp.enableSandbox();\n}\napp.whenReady();')).toBe(
        'not a top-level statement',
      );
      expect(enableSandboxPlacement('if (x) {\napp.enableSandbox();\n}\napp.whenReady();')).toBe(
        'not a top-level statement',
      );
      expect(enableSandboxPlacement('if (cond)\napp.enableSandbox();\napp.whenReady();')).toBe(
        'not a top-level statement',
      );
      expect(enableSandboxPlacement('try { app.enableSandbox(); } catch {}\napp.whenReady();')).toBe(
        'not a top-level statement',
      );
      expect(enableSandboxPlacement('app.whenReady();\napp.enableSandbox();')).toBe('after whenReady');
      expect(enableSandboxPlacement('app.whenReady();')).toBe('missing');
      expect(enableSandboxPlacement('app.enableSandbox();\napp.enableSandbox();\napp.whenReady();')).toBe('repeated');
    });
  });
});
