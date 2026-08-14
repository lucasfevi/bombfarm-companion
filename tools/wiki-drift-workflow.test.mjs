import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const WIKI_DRIFT_YML_PATH = join(root, '.github/workflows/wiki-drift.yml');

/**
 * MP5 F5 (T8, `AD-096` layer 2) — the workflow-shape guard. Every predicate below is a pure
 * function over workflow *text*, asserted twice: `true` against `readFileSync` of the real file
 * on disk, and `false` against a *string mutation of that same text* — never a synthetic
 * hand-written fixture that could drift away from the file it claims to describe (design §5.6,
 * §2.8). This is the file this milestone has hit "reports green without ever discriminating"
 * nine times over — every property here is proved capable of failing.
 */

/** Lines whose trimmed content starts with `#` — self-descriptive comments (e.g. this very file's
 * own prose naming `continue-on-error`, `|| true`, or `packages/**`) must not trip a predicate
 * that is asking about actual YAML semantics, not about what the workflow's comments say about
 * itself. */
function stripCommentLines(text) {
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
}

function hasLiveSchedule(text) {
  return /^\s*schedule:\s*$/m.test(text) && /^\s*-\s*cron:\s*'[^']+'/m.test(text);
}

/** Job names directly under the top-level `jobs:` key — 2-space-indented `key:` lines with no
 * inline value, scanned only after `jobs:` so `on.schedule:`/`on.workflow_dispatch:` (which are
 * also bare 2-space `key:` lines, just under `on:` instead) are never mistaken for jobs. */
function jobNames(text) {
  const lines = text.split('\n');
  const jobsIndex = lines.findIndex((line) => line === 'jobs:');
  if (jobsIndex === -1) return [];
  const names = [];
  for (let i = jobsIndex + 1; i < lines.length; i += 1) {
    const match = lines[i].match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (match) names.push(match[1]);
  }
  return names;
}

function singleJob(text) {
  return jobNames(text).length === 1;
}

function runsOnUbuntu(text) {
  return /runs-on:\s*ubuntu-latest/.test(text);
}

function noInstallStep(text) {
  return !/run:\s*(pnpm|npm|yarn)\s+install/.test(text) && !/playwright install/.test(text);
}

function noEscapeHatch(text) {
  const code = stripCommentLines(text);
  return (
    !/continue-on-error:\s*true/.test(code) &&
    !/\|\|\s*true/.test(code) &&
    !/;\s*exit\s+0/.test(code)
  );
}

function noJobOrStepIf(text) {
  return !/^\s*if:/m.test(text);
}

function noLabelGate(text) {
  return !/labels/.test(text);
}

function readOnlyContents(text) {
  return /contents:\s*read/.test(text) && !/contents:\s*write/.test(text);
}

function hasIssuesWrite(text) {
  return /issues:\s*write/.test(text);
}

function hasTimeout(text) {
  return /timeout-minutes:\s*\d+/.test(text);
}

function hasSerialConcurrency(text) {
  return /cancel-in-progress:\s*false/.test(text);
}

function neverPassesWriteFlag(text) {
  return !/check\.mjs.*--write/.test(text);
}

const PREDICATES = {
  hasLiveSchedule,
  singleJob,
  runsOnUbuntu,
  noInstallStep,
  noEscapeHatch,
  noJobOrStepIf,
  noLabelGate,
  readOnlyContents,
  hasIssuesWrite,
  hasTimeout,
  hasSerialConcurrency,
  neverPassesWriteFlag,
};

describe('wiki-drift.yml shape guard — the file exists and is read from disk, not a copy', () => {
  it('the file exists — a rename fails loudly rather than silently skipping every case below', () => {
    expect(() => readFileSync(WIKI_DRIFT_YML_PATH, 'utf8')).not.toThrow();
  });
});

const realText = readFileSync(WIKI_DRIFT_YML_PATH, 'utf8');

describe('wiki-drift.yml shape guard — 12 predicates, each true against the real file', () => {
  for (const [name, predicate] of Object.entries(PREDICATES)) {
    it(`${name}(realText) === true`, () => {
      expect(predicate(realText)).toBe(true);
    });
  }
});

describe('wiki-drift.yml shape guard — 15 mutations, each turning its predicate false', () => {
  it('(1) schedule commented out ⇒ hasLiveSchedule is false', () => {
    const mutated = realText.replace('  schedule:', '  # schedule:');
    expect(hasLiveSchedule(mutated)).toBe(false);
  });

  it('(2) the "- cron:" line removed ⇒ hasLiveSchedule is false', () => {
    const mutated = realText.replace(/^\s*-\s*cron:.*\n/m, '');
    expect(hasLiveSchedule(mutated)).toBe(false);
  });

  it('(3) a second job block added ⇒ singleJob is false', () => {
    const mutated = `${realText}\n  drift2:\n    runs-on: ubuntu-latest\n    steps: []\n`;
    expect(singleJob(mutated)).toBe(false);
  });

  it('(4) ubuntu-latest → windows-latest ⇒ runsOnUbuntu is false', () => {
    const mutated = realText.replace('ubuntu-latest', 'windows-latest');
    expect(runsOnUbuntu(mutated)).toBe(false);
  });

  it('(5) an install step inserted before the drift step ⇒ noInstallStep is false', () => {
    const mutated = realText.replace(
      '      - name: Compare the published wiki against the committed fingerprint',
      "      - run: pnpm install --frozen-lockfile\n      - name: Compare the published wiki against the committed fingerprint",
    );
    expect(noInstallStep(mutated)).toBe(false);
  });

  it('(6) continue-on-error: true appended to the drift step ⇒ noEscapeHatch is false', () => {
    const mutated = `${realText}        continue-on-error: true\n`;
    expect(noEscapeHatch(mutated)).toBe(false);
  });

  it('(7) "run: node …" → "run: node … || true" ⇒ noEscapeHatch is false', () => {
    const mutated = realText.replace(
      'run: node tools/wiki-drift/check.mjs',
      'run: node tools/wiki-drift/check.mjs || true',
    );
    expect(noEscapeHatch(mutated)).toBe(false);
  });

  it('(8) "run: node …" → "run: node …; exit 0" ⇒ noEscapeHatch is false', () => {
    const mutated = realText.replace(
      'run: node tools/wiki-drift/check.mjs',
      'run: node tools/wiki-drift/check.mjs; exit 0',
    );
    expect(noEscapeHatch(mutated)).toBe(false);
  });

  it("(9) a job-level if: inserted ⇒ noJobOrStepIf is false", () => {
    const mutated = realText.replace(
      '    runs-on: ubuntu-latest',
      "    if: github.event_name != 'schedule'\n    runs-on: ubuntu-latest",
    );
    expect(noJobOrStepIf(mutated)).toBe(false);
  });

  it('(10) a label-gate if: inserted ⇒ noLabelGate is false', () => {
    const mutated = realText.replace(
      '    runs-on: ubuntu-latest',
      "    if: contains(github.event.pull_request.labels.*.name, 'wiki-drift')\n    runs-on: ubuntu-latest",
    );
    expect(noLabelGate(mutated)).toBe(false);
  });

  it('(11) contents: read → contents: write ⇒ readOnlyContents is false', () => {
    const mutated = realText.replace('contents: read', 'contents: write');
    expect(readOnlyContents(mutated)).toBe(false);
  });

  it('(12) issues: write deleted ⇒ hasIssuesWrite is false', () => {
    const mutated = realText.replace('  issues: write\n', '');
    expect(hasIssuesWrite(mutated)).toBe(false);
  });

  it('(13) timeout-minutes: 10 deleted ⇒ hasTimeout is false', () => {
    const mutated = realText.replace('    timeout-minutes: 10\n', '');
    expect(hasTimeout(mutated)).toBe(false);
  });

  it('(14) cancel-in-progress: false → true ⇒ hasSerialConcurrency is false', () => {
    const mutated = realText.replace('cancel-in-progress: false', 'cancel-in-progress: true');
    expect(hasSerialConcurrency(mutated)).toBe(false);
  });

  it('(15) --write appended to the drift step ⇒ neverPassesWriteFlag is false', () => {
    const mutated = realText.replace(
      'run: node tools/wiki-drift/check.mjs',
      'run: node tools/wiki-drift/check.mjs --write',
    );
    expect(neverPassesWriteFlag(mutated)).toBe(false);
  });
});

describe('wiki-drift.yml — MWD-08: writes nothing under packages/**, no commit, no PR', () => {
  it('carries no git push, git commit, gh pr create, or a write path under packages/ (outside comments)', () => {
    const code = stripCommentLines(realText);
    expect(code).not.toMatch(/\bgit push\b/);
    expect(code).not.toMatch(/\bgit commit\b/);
    expect(code).not.toMatch(/\bgh pr create\b/);
    expect(code).not.toMatch(/packages\//);
  });

  it('red state: a run: step actually writing under packages/ is caught (not just mentioned in prose)', () => {
    const fixture = 'jobs:\n  x:\n    steps:\n      - run: echo hi >> packages/domain/src/data/x.json\n';
    expect(stripCommentLines(fixture)).toMatch(/packages\//);
  });
});

// =============================================================================================
// MWD-02: zero third-party imports across tools/wiki-drift/*.mjs — pure predicate, red state
// demonstrated against a fixture string (design §5.6), independent of the T7 per-file scan.
// =============================================================================================

function noThirdPartyImports(source) {
  const specifiers = [...source.matchAll(/^import .* from ['"]([^'"]+)['"];?$/gm)].map((m) => m[1]);
  return specifiers.every((s) => s.startsWith('node:') || s.startsWith('./'));
}

describe('tools/wiki-drift/*.mjs — zero third-party import specifiers (MWD-02)', () => {
  const files = ['fingerprint.mjs', 'fetch-endpoints.mjs', 'report.mjs', 'issue.mjs', 'check.mjs'];

  for (const file of files) {
    it(`noThirdPartyImports is true for ${file}`, () => {
      const source = readFileSync(join(root, 'tools/wiki-drift', file), 'utf8');
      expect(noThirdPartyImports(source)).toBe(true);
    });
  }

  it("red state: import fetch from 'node-fetch'; ⇒ noThirdPartyImports is false", () => {
    const fixture = "import fetch from 'node-fetch';\nexport const x = 1;\n";
    expect(noThirdPartyImports(fixture)).toBe(false);
  });
});
