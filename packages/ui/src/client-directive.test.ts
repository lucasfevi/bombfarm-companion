import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

type Violation = { reason: string };

const HOOK_NAME = /^use[A-Z\d]/;
const HANDLER_PROP = /^on[A-Z]/;

function calleeName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return undefined;
}

function isProviderAccess(node: ts.Node | undefined): boolean {
  return node !== undefined && ts.isPropertyAccessExpression(node) && node.name.text === 'Provider';
}

function isFunctionValue(node: ts.Node | undefined): boolean {
  return node !== undefined && (ts.isArrowFunction(node) || ts.isFunctionExpression(node));
}

function hasLeadingUseClientDirective(source: ts.SourceFile): boolean {
  const first = source.statements[0];
  return (
    first !== undefined &&
    ts.isExpressionStatement(first) &&
    ts.isStringLiteral(first.expression) &&
    first.expression.text === 'use client'
  );
}

function findClientOnlyUsage(source: ts.SourceFile): Violation[] {
  const declaredFunctions = new Set<string>();
  const collect = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name) declaredFunctions.add(node.name.text);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && isFunctionValue(node.initializer)) {
      declaredFunctions.add(node.name.text);
    }
    ts.forEachChild(node, collect);
  };
  collect(source);

  const found: Violation[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const name = calleeName(node.expression);
      if (name === 'createContext') found.push({ reason: 'calls createContext' });
      else if (name !== undefined && HOOK_NAME.test(name)) found.push({ reason: `calls hook ${name}` });
      if (name === 'createElement' && isProviderAccess(node.arguments[0])) {
        found.push({ reason: 'renders a context provider' });
      }
    }
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      isProviderAccess(node.tagName)
    ) {
      found.push({ reason: 'renders a context provider' });
    }
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && HANDLER_PROP.test(node.name.text)) {
      const value = node.initializer;
      if (value && ts.isJsxExpression(value) && value.expression) {
        const expression = value.expression;
        const inline = isFunctionValue(expression);
        const declared = ts.isIdentifier(expression) && declaredFunctions.has(expression.text);
        if (inline || declared) found.push({ reason: `defines a function for ${node.name.text}` });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found.filter((v, i) => found.findIndex((w) => w.reason === v.reason) === i);
}

function findClientDirectiveViolations(fileName: string, text: string): Violation[] {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
  if (hasLeadingUseClientDirective(source)) return [];
  return findClientOnlyUsage(source);
}

describe('findClientDirectiveViolations', () => {
  const createContextSource = `import { createContext } from 'react';\nexport const Ctx = createContext(0);\n`;
  const hookSource = `import { useState } from 'react';\nexport function A() {\n  const [n] = useState(0);\n  return n;\n}\n`;
  const handlerSource = `export function A() {\n  return <button onClick={() => console.log(1)}>x</button>;\n}\n`;
  const withDirective = (text: string) => `'use client';\n\n${text}`;

  it('reports a module that calls createContext without the directive', () => {
    expect(findClientDirectiveViolations('ctx.ts', createContextSource)).toHaveLength(1);
  });

  it('reports a module that calls a hook without the directive', () => {
    expect(findClientDirectiveViolations('a.tsx', hookSource)).toHaveLength(1);
  });

  it('reports a namespaced hook call', () => {
    const text = `import * as React from 'react';\nexport const f = () => React.useRef(null);\n`;
    expect(findClientDirectiveViolations('a.tsx', text)).toHaveLength(1);
  });

  it('reports a module with an inline onClick handler without the directive', () => {
    expect(findClientDirectiveViolations('a.tsx', handlerSource)).toHaveLength(1);
  });

  it('reports a handler declared in the body and passed to an on* prop', () => {
    const text = `export function A() {\n  const go = () => 1;\n  return <button onClick={go}>x</button>;\n}\n`;
    expect(findClientDirectiveViolations('a.tsx', text)).toHaveLength(1);
  });

  it('reports a module that renders a context provider without the directive', () => {
    const text = `export function A() {
  return <Ctx.Provider value={1}>x</Ctx.Provider>;
}
`;
    expect(findClientDirectiveViolations('a.tsx', text)).toEqual([{ reason: 'renders a context provider' }]);
  });

  it('reports a context provider passed to createElement without the directive', () => {
    const text = `import { createElement } from 'react';
export const A = () => createElement(Ctx.Provider, { value: 1 });
`;
    expect(findClientDirectiveViolations('a.ts', text)).toEqual([{ reason: 'renders a context provider' }]);
  });

  it('does not report a rendered context provider when use client is the first statement', () => {
    const text = `'use client';

export function A() {
  return <Ctx.Provider value={1}>x</Ctx.Provider>;
}
`;
    expect(findClientDirectiveViolations('a.tsx', text)).toEqual([]);
  });

  it.each([
    ['createContext', createContextSource, 'ctx.ts'],
    ['useState', hookSource, 'a.tsx'],
    ['onClick', handlerSource, 'a.tsx'],
  ])('does not report %s when use client is the first statement', (_name, text, file) => {
    expect(findClientDirectiveViolations(file, withDirective(text))).toEqual([]);
  });

  it('reports a directive that follows an import, since React ignores it there', () => {
    const text = `import { useState } from 'react';\n'use client';\nexport const f = () => useState(0);\n`;
    expect(findClientDirectiveViolations('a.tsx', text)).toHaveLength(1);
  });

  it('does not report a module that only re-exports', () => {
    expect(findClientDirectiveViolations('index.ts', `export * from './a';\nexport { b } from './b';\n`)).toEqual([]);
  });

  it('does not report a type that declares an onClick prop', () => {
    const text = `export type P = { onClick?: () => void };\nexport function A({ onClick }: P) {\n  return <button onClick={onClick}>x</button>;\n}\n`;
    expect(findClientDirectiveViolations('a.tsx', text)).toEqual([]);
  });

  it('ignores hook names in comments and strings', () => {
    const text = `// call useState() here\nexport const label = 'useEffect( createContext(';\n/* useRef() */\n`;
    expect(findClientDirectiveViolations('a.ts', text)).toEqual([]);
  });
});

function listModules(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__snapshots__' ? [] : listModules(path);
    if (!/\.tsx?$/.test(entry.name)) return [];
    if (/\.(test|stories)\.tsx?$/.test(entry.name) || entry.name === 'dom-test-harness.ts') return [];
    return [path];
  });
}

describe('packages/ui/src modules', () => {
  const root = dirname(fileURLToPath(import.meta.url));

  it('mark every context, hook and handler module with use client as the first statement', () => {
    const offenders = listModules(root).flatMap((path) =>
      findClientDirectiveViolations(path, readFileSync(path, 'utf8')).map(
        ({ reason }) => `${relative(root, path).replaceAll(sep, '/')}: ${reason}`,
      ),
    );
    expect(offenders).toEqual([]);
  });
});
