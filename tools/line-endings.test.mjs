import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The repo is LF everywhere (`.gitattributes`, `docs/line-endings.md`). This guard
 * reads the *index* — what is actually stored in git — rather than the files on
 * disk, because that is where the drift used to live: before the normalization
 * commit, 532 files were committed with CRLF and two carried both endings inside
 * a single file. An in-place stream edit on one of those strips every CR and
 * turns a one-line change into a whole-file diff.
 */
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

/**
 * `git ls-files --eol` reports the index eol as one of:
 *   i/lf     — normalized text, the convention
 *   i/crlf   — a text file stored with CRLF        (rejected)
 *   i/mixed  — one file carrying both endings      (rejected)
 *   i/-text  — binary, git never inspects it       (allowed)
 *   i/none   — text with no line terminator at all (allowed; today that is
 *              exactly packages/domain/src/data/{catalog,phases}.json, the two
 *              minified files an emitter writes and .editorconfig exempts from
 *              the final-newline rule)
 */
const ALLOWED_INDEX_EOL = new Set(['i/lf', 'i/-text', 'i/none']);
const REJECTED_INDEX_EOL = new Set(['i/crlf', 'i/mixed']);

/**
 * A floor on the tracked-file count. Without it, anything that makes git return
 * no output at all (wrong cwd, a shallow/empty checkout) would satisfy "no CRLF
 * entries" vacuously and this suite would go green without checking anything.
 */
const MINIMUM_TRACKED_FILES = 500;

const FIX_HINT = [
  'The repo is LF everywhere. To fix:',
  '',
  '  git add --renormalize .',
  '  git commit -m "chore: normalize line endings"',
  '',
  'Never repair this with an in-place stream edit (`sed -i`) — that rewrites the',
  'whole file. See `.gitattributes` and `docs/line-endings.md`.',
].join('\n');

/**
 * Parses `git ls-files --eol` output.
 *
 * Each line is `i/<eol>\tw/<eol>\tattr/<attrs>\t<path>` with the columns padded
 * by spaces, so the path is everything after the last tab and may itself contain
 * spaces.
 */
export function parseEolReport(output) {
  return output
    .split('\n')
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const separator = line.lastIndexOf('\t');
      const head = line.slice(0, separator);
      const columns = head.trim().split(/\s+/);
      // The `attr/` column carries space-separated attributes of its own (`attr/text=auto eol=lf`),
      // so it runs to the end of the head rather than being one whitespace-delimited column.
      const attrStart = head.indexOf('attr/');
      const attributes = attrStart === -1 ? [] : head.slice(attrStart + 'attr/'.length).trim().split(/\s+/).filter(Boolean);
      return { indexEol: columns[0], attributes, path: line.slice(separator + 1) };
    });
}

/**
 * A file `.gitattributes` declares `binary` reports `attr/-text`. Git still classifies its bytes,
 * so one can come back `i/mixed` when the content happens to look like text — which is precisely
 * the sniffing this declaration exists to overrule, not a policy violation. Declaring a file
 * binary is a deliberate, reviewable edit to `.gitattributes`, so honouring it here cannot be
 * used to smuggle a real text file past the rule.
 */
function isDeclaredBinary(entry) {
  return entry.attributes.includes('-text');
}

/** Entries whose stored eol is not LF (or a legitimately exempt kind). */
export function findOffenders(entries) {
  return entries.filter((entry) => !ALLOWED_INDEX_EOL.has(entry.indexEol) && !isDeclaredBinary(entry));
}

let cachedEntries = null;

function readIndexEolEntries() {
  if (cachedEntries !== null) return cachedEntries;

  let output;
  try {
    output = execFileSync('git', ['-c', 'core.quotePath=false', 'ls-files', '--eol'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    });
  } catch (error) {
    // Deliberately a failure, not a skip. A guard that cannot run is a guard that
    // is not guarding, and a suite that reports green without executing is worse
    // than no suite — it retires the question.
    throw new Error(
      `Could not run \`git ls-files --eol\` in ${root}, so the LF policy is unverified. ` +
        'This is a failure, not a skip: install git (or run the suite inside the ' +
        `repository) rather than trusting an unchecked tree. Underlying error: ${error.message}`,
    );
  }

  cachedEntries = parseEolReport(output);
  return cachedEntries;
}

describe('line-ending policy — LF everywhere in the index', () => {
  it('git reports a full tracked-file corpus, so the assertions below are not vacuous', () => {
    const entries = readIndexEolEntries();
    expect(
      entries.length,
      `\`git ls-files --eol\` returned ${entries.length} entries from ${root}, below the ` +
        `${MINIMUM_TRACKED_FILES}-file floor. The guard cannot see the repository.`,
    ).toBeGreaterThan(MINIMUM_TRACKED_FILES);
  });

  it('every tracked entry reports a recognized index eol', () => {
    const entries = readIndexEolEntries();
    const unrecognized = entries.filter(
      (entry) => !ALLOWED_INDEX_EOL.has(entry.indexEol) && !REJECTED_INDEX_EOL.has(entry.indexEol),
    );
    expect(
      unrecognized.map((entry) => `${entry.indexEol} ${entry.path}`),
      'Unknown `i/<eol>` value — the parser or git\'s output format changed.',
    ).toEqual([]);
  });

  it('no file is stored with CRLF or mixed endings', () => {
    const offenders = findOffenders(readIndexEolEntries());
    expect(
      offenders.map((entry) => `${entry.indexEol}\t${entry.path}`),
      `${offenders.length} tracked file(s) are not stored with LF endings:\n` +
        `${offenders.map((entry) => `  ${entry.indexEol}  ${entry.path}`).join('\n')}\n\n${FIX_HINT}`,
    ).toEqual([]);
  });

  it('red state demonstrated: a planted CRLF and a planted mixed entry are both caught', () => {
    const planted = parseEolReport(
      [
        'i/lf    w/lf    attr/text=auto eol=lf \tsrc/fine.ts',
        'i/crlf  w/crlf  attr/                 \tsrc/with spaces/bad.ts',
        'i/mixed w/mixed attr/                 \tsrc/worse.ts',
        'i/-text w/-text attr/                 \tpublic/art.png',
        'i/none  w/none  attr/                 \tdata/oneline.json',
        'i/mixed w/mixed attr/-text            \tfixtures/capture.bin',
        'i/crlf  w/crlf  attr/text=auto eol=lf \tsrc/declared-text.ts',
      ].join('\n'),
    );
    expect(planted).toHaveLength(7);
    // A file `.gitattributes` declares binary is exempt; declaring one `text` cannot buy an
    // exemption, so the escape hatch is exactly as wide as a reviewed `.gitattributes` edit.
    expect(findOffenders(planted).map((entry) => entry.path)).toEqual([
      'src/with spaces/bad.ts',
      'src/worse.ts',
      'src/declared-text.ts',
    ]);
  });
});

describe('line-ending policy — the attributes that keep it that way', () => {
  const attributes = readFileSync(join(root, '.gitattributes'), 'utf8');

  it('pins LF as the repo-wide baseline', () => {
    expect(attributes).toMatch(/^\*\s+text=auto\s+eol=lf\s*$/m);
  });

  it('marks the bundled art binary explicitly, so a renormalize can never rewrite it', () => {
    expect(attributes).toMatch(/^\*\.png\s+(binary|-text)\s*$/m);
  });

  it('keeps the husky hooks on LF', () => {
    expect(attributes).toMatch(/^\.husky\/\*\s+text\s+eol=lf\s*$/m);
  });
});
