import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * `index.ts` cannot be imported by a test, so what it hands the session and the windows is read
 * from its syntax tree. Comments and string contents never count: a call that is commented out,
 * sits behind an `if`, or is replaced by an empty arrow function leaves the tree different from the
 * one pinned here.
 */
const MAIN_INDEX = resolve(__dirname, 'index.ts');

function parse(source: string): ts.SourceFile {
  return ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function functionBody(sourceFile: ts.SourceFile, name: string): ts.Block {
  const found = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  if (!found?.body) throw new Error(`no function ${name} in index.ts`);
  return found.body;
}

function callStatements(body: ts.Block, calleeText: string, sourceFile: ts.SourceFile): number[] {
  return body.statements.flatMap((statement, index) => {
    const expression = ts.isExpressionStatement(statement) ? statement.expression : undefined;
    const call = expression && ts.isAwaitExpression(expression) ? expression.expression : expression;
    return call && ts.isCallExpression(call) && call.expression.getText(sourceFile) === calleeText ? [index] : [];
  });
}

function normalised(node: ts.Node, sourceFile: ts.SourceFile): string {
  return node.getText(sourceFile).replace(/\s+/g, ' ');
}

export function findSessionSecurityWiring(source: string): string[] {
  const sourceFile = parse(source);
  const problems: string[] = [];
  const body = functionBody(sourceFile, 'bootstrap');

  const installs = callStatements(body, 'installSessionSecurity', sourceFile);
  const windows = callStatements(body, 'createMainWindow', sourceFile);
  if (installs.length !== 1) {
    problems.push(`bootstrap must call installSessionSecurity exactly once, unconditionally; found ${String(installs.length)}`);
  } else if (windows.length !== 1 || (installs[0] ?? 0) > (windows[0] ?? 0)) {
    problems.push('installSessionSecurity must run before the first window is created');
  } else {
    const statement = body.statements[installs[0] ?? 0];
    const call = ts.isExpressionStatement(statement as ts.Node) ? (statement as ts.ExpressionStatement).expression : undefined;
    const argument = call && ts.isCallExpression(call) ? call.arguments[0] : undefined;
    if (!argument || !ts.isObjectLiteralExpression(argument)) {
      problems.push('installSessionSecurity must be handed one object literal');
    } else {
      const given = new Map(
        argument.properties.map((property) => [
          property.name?.getText(sourceFile) ?? '',
          ts.isShorthandPropertyAssignment(property)
            ? property.name.getText(sourceFile)
            : ts.isPropertyAssignment(property)
              ? normalised(property.initializer, sourceFile)
              : '',
        ]),
      );
      const expected: Record<string, string> = {
        app: 'app',
        session: 'session.defaultSession',
        isDev: 'env.isDev',
        devRendererUrl: 'RENDERER_DEV_URL',
        log: 'log',
      };
      for (const [key, value] of Object.entries(expected)) {
        if (given.get(key) !== value) problems.push(`installSessionSecurity ${key} must be ${value}, found ${given.get(key) ?? 'nothing'}`);
      }
      if (given.size !== Object.keys(expected).length) problems.push('installSessionSecurity was handed an unexpected property');
    }
  }
  return problems;
}

export function findNavigationPolicyWiring(source: string): string[] {
  const sourceFile = parse(source);
  const problems: string[] = [];

  const applier = functionBody(sourceFile, 'windowNavigationPolicy');
  const returned = applier.statements.find(ts.isReturnStatement)?.expression;
  if (!returned || !ts.isCallExpression(returned) || returned.expression.getText(sourceFile) !== 'createNavigationPolicyApplier') {
    problems.push('windowNavigationPolicy must return createNavigationPolicyApplier(...)');
  } else {
    const [env] = returned.arguments;
    if (!env || normalised(env, sourceFile) !== '{ isDev: env.isDev, devRendererUrl: RENDERER_DEV_URL }') {
      problems.push('windowNavigationPolicy must hand the applier the real isDev and dev renderer url');
    }
  }

  const mainBody = functionBody(sourceFile, 'createMainWindow');
  const entry = mainBody.statements.find(
    (statement): statement is ts.VariableStatement =>
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some((declaration) => declaration.name.getText(sourceFile) === 'entryUrl'),
  );
  const entryInitializer = entry?.declarationList.declarations[0]?.initializer;
  if (!entryInitializer || normalised(entryInitializer, sourceFile) !== 'env.isDev ? RENDERER_DEV_URL : RENDERER_ENTRY_URL') {
    problems.push('createMainWindow must derive entryUrl from env.isDev as the dev url or the packaged entry url');
  }
  const mainApplied = mainBody.statements.some((statement) => {
    if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) return false;
    const { expression, arguments: args } = statement.expression;
    return (
      ts.isCallExpression(expression) &&
      expression.expression.getText(sourceFile) === 'windowNavigationPolicy' &&
      normalised(expression, sourceFile) === 'windowNavigationPolicy(env)' &&
      args.map((arg) => normalised(arg, sourceFile)).join('|') === 'mainWindow.webContents|entryUrl'
    );
  });
  if (!mainApplied) problems.push('createMainWindow must apply windowNavigationPolicy(env) to mainWindow.webContents with entryUrl, unconditionally');
  const loads = mainBody.getText(sourceFile).match(/mainWindow\.loadURL\(entryUrl\)/g) ?? [];
  if (loads.length !== 2) problems.push('createMainWindow must load entryUrl, the page the policy sends the window back to, in both branches');

  const miniBody = functionBody(sourceFile, 'createMiniLiveControllerInstance');
  const miniApplied: boolean[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node) && node.name.getText(sourceFile) === 'applyExternalNavigation') {
      const handler = node.initializer;
      if (ts.isArrowFunction(handler) && ts.isBlock(handler.body)) {
        miniApplied.push(handler.body.statements.some(
          (statement) =>
            ts.isExpressionStatement(statement) &&
            ts.isCallExpression(statement.expression) &&
            ts.isCallExpression(statement.expression.expression) &&
            normalised(statement.expression.expression, sourceFile) === 'windowNavigationPolicy(env)' &&
            statement.expression.arguments.map((arg) => normalised(arg, sourceFile)).join('|') ===
              'webContents as WebContents|entryUrl',
        ));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(miniBody);
  if (!miniApplied.includes(true)) problems.push('the compact window must apply windowNavigationPolicy(env) to its web contents with its entry url');

  return problems;
}

export function findFilePickerSwitch(source: string): string[] {
  const sourceFile = parse(source);
  const found = sourceFile.statements.some(
    (statement) =>
      ts.isExpressionStatement(statement) &&
      ts.isCallExpression(statement.expression) &&
      statement.expression.expression.getText(sourceFile) === 'app.commandLine.appendSwitch' &&
      statement.expression.arguments.map((argument) => argument.getText(sourceFile)).join('|') ===
        "'disable-blink-features'|'FileSystemAccessLocal'",
  );
  return found ? [] : ['index.ts must switch off the file pickers at the top level, before the app is ready'];
}

const IMPORTED_BINDINGS: readonly (readonly [string, string])[] = [
  ['installSessionSecurity', './session-permissions.js'],
  ['createNavigationPolicyApplier', './external-navigation.js'],
];
const DECLARED_LOCALLY: readonly string[] = ['windowNavigationPolicy'];

function declaresName(node: ts.Node, name: string): boolean {
  const declared =
    (ts.isVariableDeclaration(node) ||
      ts.isParameter(node) ||
      ts.isBindingElement(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isClassDeclaration(node) ||
      ts.isClassExpression(node) ||
      ts.isImportSpecifier(node) ||
      ts.isImportClause(node) ||
      ts.isNamespaceImport(node) ||
      ts.isImportEqualsDeclaration(node)) &&
    node.name !== undefined &&
    ts.isIdentifier(node.name) &&
    node.name.text === name;
  return declared;
}

export function findBindingProblems(source: string): string[] {
  const sourceFile = parse(source);
  const problems: string[] = [];
  const names = [...IMPORTED_BINDINGS.map(([name]) => name), ...DECLARED_LOCALLY];
  const declarations = new Map<string, ts.Node[]>(names.map((name) => [name, []]));

  const visit = (node: ts.Node): void => {
    for (const name of names) {
      if (declaresName(node, name)) declarations.get(name)?.push(node);
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
      ts.isIdentifier(node.left) &&
      names.includes(node.left.text)
    ) {
      problems.push(`${node.left.text} is reassigned`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  for (const [name, module] of IMPORTED_BINDINGS) {
    const found = declarations.get(name) ?? [];
    const legitimate = found.filter(
      (node) =>
        ts.isImportSpecifier(node) &&
        node.propertyName === undefined &&
        !node.isTypeOnly &&
        ts.isNamedImports(node.parent) &&
        node.parent.parent.phaseModifier !== ts.SyntaxKind.TypeKeyword &&
        ts.isImportDeclaration(node.parent.parent.parent) &&
        ts.isStringLiteral(node.parent.parent.parent.moduleSpecifier) &&
        node.parent.parent.parent.moduleSpecifier.text === module,
    );
    if (legitimate.length !== 1 || found.length !== 1) {
      problems.push(`${name} must be bound once, by a plain named import from ${module}, and by nothing else`);
    }
  }
  for (const name of DECLARED_LOCALLY) {
    const found = declarations.get(name) ?? [];
    if (found.length !== 1 || !ts.isFunctionDeclaration(found[0] as ts.Node)) {
      problems.push(`${name} must be declared once, as a function declaration`);
    }
  }
  return problems;
}

const source = readFileSync(MAIN_INDEX, 'utf8');

describe('window and session security wiring in index.ts', () => {
  it('hands the shared session its security once, unconditionally, before a window exists', () => {
    expect(findSessionSecurityWiring(source)).toEqual([]);
  });

  it('applies the navigation policy to both windows with the page each was created with', () => {
    expect(findNavigationPolicyWiring(source)).toEqual([]);
  });

  it('binds the wiring functions to the real modules and nothing else', () => {
    expect(findBindingProblems(source)).toEqual([]);

    const wired = `
      import { installSessionSecurity } from './session-permissions.js';
      import { createNavigationPolicyApplier } from './external-navigation.js';
      function windowNavigationPolicy(env) { return createNavigationPolicyApplier(env, {}); }
      async function bootstrap() { installSessionSecurity({}); }`;
    expect(findBindingProblems(wired)).toEqual([]);

    const mutants: Record<string, string> = {
      'import replaced by a local no-op': wired.replace(
        "import { installSessionSecurity } from './session-permissions.js';",
        'function installSessionSecurity() {}',
      ),
      'import from another module': wired.replace("'./session-permissions.js'", "'./elsewhere.js'"),
      'import under an alias': wired.replace(
        '{ createNavigationPolicyApplier }',
        '{ somethingElse as createNavigationPolicyApplier }',
      ),
      'import of a type only': wired.replace('{ installSessionSecurity }', '{ type installSessionSecurity }'),
      'shadowing parameter': wired.replace('async function bootstrap()', 'async function bootstrap(installSessionSecurity)'),
      'shadowing constant': wired.replace('installSessionSecurity({});', 'const installSessionSecurity = () => {}; installSessionSecurity({});'),
      'reassignment': wired.replace('installSessionSecurity({});', 'installSessionSecurity = () => {}; installSessionSecurity({});'),
      'applier replaced by a local no-op': wired.replace(
        "import { createNavigationPolicyApplier } from './external-navigation.js';",
        'const createNavigationPolicyApplier = () => () => {};',
      ),
      'policy function turned into a constant': wired.replace(
        'function windowNavigationPolicy(env) {',
        'const windowNavigationPolicy = (env) => { return () => {}; }; function other(env) {',
      ),
      'policy function declared twice': `${wired} function windowNavigationPolicy() {}`,
    };
    for (const [name, mutant] of Object.entries(mutants)) {
      expect(findBindingProblems(mutant), name).not.toEqual([]);
    }
  });

  it('switches the file pickers off at the top level', () => {
    const switchOff = "app.commandLine.appendSwitch('disable-blink-features', 'FileSystemAccessLocal');";
    expect(findFilePickerSwitch(source)).toEqual([]);
    expect(findFilePickerSwitch(switchOff)).toEqual([]);
    expect(findFilePickerSwitch(`// ${switchOff}`)).not.toEqual([]);
    expect(findFilePickerSwitch(`if (flag) { ${switchOff} }`)).not.toEqual([]);
    expect(findFilePickerSwitch(switchOff.replace('FileSystemAccessLocal', 'Other'))).not.toEqual([]);
  });

  it('catches a call that is commented out, conditional, late, duplicated or handed the wrong value', () => {
    const call = 'installSessionSecurity({ app, session: session.defaultSession, isDev: env.isDev, devRendererUrl: RENDERER_DEV_URL, log });';
    const wrap = (inner: string): string => `async function bootstrap() { ${inner} await createMainWindow(); }`;
    expect(findSessionSecurityWiring(wrap(call))).toEqual([]);
    expect(findSessionSecurityWiring(wrap(`/* ${call} */`))).not.toEqual([]);
    expect(findSessionSecurityWiring(wrap(`// ${call}\n`))).not.toEqual([]);
    expect(findSessionSecurityWiring(wrap(`if (false) { ${call} }`))).not.toEqual([]);
    expect(findSessionSecurityWiring(wrap(`${call} ${call}`))).not.toEqual([]);
    expect(findSessionSecurityWiring(wrap(call.replace('env.isDev', 'true')))).not.toEqual([]);
    expect(findSessionSecurityWiring(wrap(call.replace('session.defaultSession', 'otherSession')))).not.toEqual([]);
    expect(
      findSessionSecurityWiring(`async function bootstrap() { await createMainWindow(); ${call} }`),
    ).not.toEqual([]);
  });

  it('catches a compact window whose navigation policy is a no-op', () => {
    const wired = `
      function windowNavigationPolicy(env) { return createNavigationPolicyApplier({ isDev: env.isDev, devRendererUrl: RENDERER_DEV_URL }, {}); }
      async function createMainWindow() {
        const entryUrl = env.isDev ? RENDERER_DEV_URL : RENDERER_ENTRY_URL;
        windowNavigationPolicy(env)(mainWindow.webContents, entryUrl);
        if (env.isDev) { await mainWindow.loadURL(entryUrl); } else { await mainWindow.loadURL(entryUrl); }
      }
      function createMiniLiveControllerInstance(env) {
        return createMiniLiveController({
          applyExternalNavigation: (webContents, entryUrl) => {
            windowNavigationPolicy(env)(webContents as WebContents, entryUrl);
          },
        });
      }`;
    expect(findNavigationPolicyWiring(wired)).toEqual([]);
    expect(
      findNavigationPolicyWiring(
        wired.replace('windowNavigationPolicy(env)(webContents as WebContents, entryUrl);', ''),
      ),
    ).not.toEqual([]);
    expect(
      findNavigationPolicyWiring(wired.replace(/applyExternalNavigation: \(webContents, entryUrl\) => \{[^}]*\}/, 'applyExternalNavigation: () => {}')),
    ).not.toEqual([]);
    expect(
      findNavigationPolicyWiring(wired.replace('windowNavigationPolicy(env)(mainWindow.webContents, entryUrl);', '')),
    ).not.toEqual([]);
    expect(findNavigationPolicyWiring(wired.replace('isDev: env.isDev', 'isDev: true'))).not.toEqual([]);
  });
});
