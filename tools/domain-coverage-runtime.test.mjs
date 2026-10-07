import { describe, expect, it } from 'vitest';
import { hasRuntimeCode } from './domain-coverage-runtime.mjs';

describe('hasRuntimeCode', () => {
  it.each([
    ['a type-only module', "export type A = { a: number };\nexport interface B { b: string }\n"],
    ['type imports and type re-exports', "import type { A } from './a';\nimport { type B } from './b';\nexport type { A, B };\n"],
    ['a re-export barrel', "export * from './a';\nexport { b } from './b';\nexport type { C } from './c';\n"],
    ['an empty module', 'export {};\n'],
    ['an import used only as a type', "import { Thing } from './thing';\nexport type Alias = Thing;\n"],
    ['declare statements and a type-only namespace', "declare const x: number;\nexport declare function f(): void;\nexport namespace Shapes { export type Id = string }\n"],
  ])('%s has no runtime code', (_, source) => {
    expect(hasRuntimeCode(source)).toBe(false);
  });

  it.each([
    ['a function', 'export function f(): number { return 1; }\n'],
    ['a constant', "export const REFERRAL = 'x';\n"],
    ['a class', 'export class A {}\n'],
    ['an enum', 'export enum Color { Red }\n'],
    ['a const enum', 'export const enum Color { Red }\n'],
    ['a default export', 'const x = 1;\nexport default x;\n'],
    ['a bare call', "import { setup } from './setup';\nsetup();\n"],
    ['a namespace with a value', 'export namespace N { export const v = 1; }\n'],
  ])('%s is runtime code', (_, source) => {
    expect(hasRuntimeCode(source)).toBe(true);
  });
});
