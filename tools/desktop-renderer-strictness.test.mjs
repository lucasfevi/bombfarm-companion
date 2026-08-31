import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

/**
 * The desktop renderer was drawn from a stock Next.js template, whose tsconfig sets `strict` and
 * stops there. That is two flags short of `tsconfig.base.json`: `exactOptionalPropertyTypes` and
 * `noUncheckedIndexedAccess`. So `pnpm --filter @bombfarm/desktop typecheck` checked the renderer
 * at a bar LOOSER than the repo's own — looser, in those two flags, than the packages that hold a
 * documented exception — and roughly fifty errors of exactly those two classes sat in the renderer
 * unseen. ESLint parses the same files through a base-tier program, but ESLint reports its own
 * rules and never a tsc assignability error, so nothing surfaced them.
 *
 * Both halves are load-bearing and both are one line from being undone: the renderer project can
 * stop extending the base, or the base can stop turning the flags on. This resolves the project
 * the way `tsc -p` does — extends chain and all — and asserts what the compiler will actually
 * enforce, rather than how any one file happens to spell it.
 */
const PROJECTS = {
  'the desktop renderer': 'apps/desktop/renderer/tsconfig.json',
  'the desktop main process': 'apps/desktop/tsconfig.main.json',
};

const STRICTNESS_FLAGS = ['strict', 'exactOptionalPropertyTypes', 'noUncheckedIndexedAccess'];

function compilerOptionsOf(relativePath) {
  const configPath = resolve(root, relativePath);
  const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    },
  });
  if (!parsed) throw new Error(`could not read ${relativePath}`);
  return parsed.options;
}

describe('the desktop is typechecked at the repo base tier', () => {
  for (const [label, relativePath] of Object.entries(PROJECTS)) {
    for (const flag of STRICTNESS_FLAGS) {
      it(`${label} resolves ${flag} to true`, () => {
        expect(compilerOptionsOf(relativePath)[flag]).toBe(true);
      });
    }
  }

  it('both desktop projects are the ones the package typecheck script runs', () => {
    const scripts = JSON.parse(
      ts.sys.readFile(resolve(root, 'apps/desktop/package.json')) ?? '{}',
    ).scripts;
    for (const relativePath of Object.values(PROJECTS)) {
      expect(scripts.typecheck).toContain(relativePath.replace('apps/desktop/', ''));
    }
  });
});
