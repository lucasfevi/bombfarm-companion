import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { electronBundles, SANDBOX_PRELOAD_MODULES } from './electron-bundles.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..');

const SANDBOX_PROCESS_MEMBERS = [
  'arch',
  'argv',
  'contextIsolated',
  'env',
  'pid',
  'platform',
  'sandboxed',
  'type',
  'version',
  'versions',
];

/** Prose inside string literals and comments (an error message saying "process. It could…") is not code. */
function withoutStringsAndComments(code) {
  return code
    .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

function sandboxViolations(code) {
  const violations = [];

  for (const match of code.matchAll(/(?<![\w$])require\s*\(\s*([^)]*)\)/g)) {
    const literal = /^(["'`])([^"'`]+)\1$/.exec(match[1].trim());
    if (!literal) {
      violations.push(`dynamic require(${match[1].trim()})`);
    } else if (!SANDBOX_PRELOAD_MODULES.includes(literal[2])) {
      violations.push(`require of "${literal[2]}"`);
    }
  }

  const executable = withoutStringsAndComments(code);

  for (const match of executable.matchAll(/(?<![\w$])import\s*\(/g)) {
    violations.push(`dynamic import at offset ${String(match.index)}`);
  }

  for (const match of executable.matchAll(/(?<![\w$])process\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[)/g)) {
    const member = match[1];
    if (member === undefined) violations.push('computed process access');
    else if (!SANDBOX_PROCESS_MEMBERS.includes(member)) violations.push(`process.${member}`);
  }

  for (const match of executable.matchAll(/(?<![\w$])(__dirname|__filename)(?![\w$])/g)) {
    violations.push(match[1]);
  }

  return violations;
}

async function bundlePreload() {
  const { preload } = electronBundles({
    src: path.join(desktopRoot, 'src'),
    dist: path.join(desktopRoot, 'dist'),
  });
  const result = await esbuild.build({ ...preload, write: false, sourcemap: false, logLevel: 'silent' });
  expect(result.outputFiles).toHaveLength(1);
  return result.outputFiles[0].text;
}

describe('the preload bundle runs inside the renderer sandbox', () => {
  it('requires nothing the sandbox does not provide and reaches for no Node-only global', async () => {
    expect(sandboxViolations(await bundlePreload())).toEqual([]);
  });

  it('brings electron-log into the bundle instead of requiring it at load time', async () => {
    const code = await bundlePreload();

    expect(code).not.toMatch(/require\(\s*["']electron-log/);
    expect(code).toContain('__electronLog');
  });

  it('still requires electron itself, which is what exposes the bridge', async () => {
    expect(await bundlePreload()).toMatch(/require\(\s*"electron"\s*\)/);
  });
});

describe('sandboxViolations', () => {
  it('red state demonstrated: a Node builtin is caught, with or without the node: prefix', () => {
    expect(sandboxViolations('var fs = require("fs");')).toEqual(['require of "fs"']);
    expect(sandboxViolations("const p = require('node:path');")).toEqual(['require of "node:path"']);
  });

  it('red state demonstrated: a package left external is caught', () => {
    expect(sandboxViolations('var log = require("electron-log/renderer.js");')).toEqual([
      'require of "electron-log/renderer.js"',
    ]);
  });

  it('red state demonstrated: a require the scan cannot read is caught', () => {
    expect(sandboxViolations('var m = require(name);')).toEqual(['dynamic require(name)']);
  });

  it('red state demonstrated: process members the sandbox lacks are caught', () => {
    expect(sandboxViolations('process.cwd(); process.type; process["binding"]("fs");')).toEqual([
      'process.cwd',
      'computed process access',
    ]);
  });

  it('red state demonstrated: process.resourcesPath, which the sandbox leaves undefined, is caught', () => {
    expect(sandboxViolations('const dir = process.resourcesPath;')).toEqual(['process.resourcesPath']);
  });

  it('red state demonstrated: reaching process or require through another object is caught', () => {
    expect(sandboxViolations('globalThis.process.cwd();')).toEqual(['process.cwd']);
    expect(sandboxViolations('module.require("fs");')).toEqual(['require of "fs"']);
  });

  it('does not mistake prose in a string or comment for code', () => {
    const code = 'warn("loaded in the main process. It could cause trouble"); // process.cwd()';

    expect(sandboxViolations(code)).toEqual([]);
  });

  it('red state demonstrated: __dirname is caught', () => {
    expect(sandboxViolations('var here = __dirname;')).toEqual(['__dirname']);
  });

  it('red state demonstrated: a dynamic import is caught', () => {
    expect(sandboxViolations('const mod = import("node:fs");')).toHaveLength(1);
  });

  it('lets through the four modules the sandbox provides and the process members it supplies', () => {
    const code = [
      'require("electron");',
      'require("events");',
      'require("timers");',
      'require("url");',
      'process.type; process.platform; process.versions;',
    ].join('\n');

    expect(sandboxViolations(code)).toEqual([]);
  });
});
