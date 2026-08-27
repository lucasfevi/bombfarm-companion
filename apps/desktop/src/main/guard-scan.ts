/**
 * Directory walking shared by this folder's source guards (`i18n-guards`, `planning-guards`,
 * `retired-ipc-channel-guards`, `live-source-boundary`).
 *
 * Those files previously each kept their own verbatim copy, on a stated convention that
 * "each guard file owns its scan". The copies drifted and the convention cost more than it
 * bought: adding one ignored directory name (`.next-dev`, when `next dev` moved to its own dist
 * directory) meant editing the same skip list four times, and `planning-guards`' copy already
 * documented itself as carrying a branch that was inert in its own scans purely to stay
 * byte-identical with the others.
 *
 * It lives here rather than in `tools/` deliberately: `ci-fidelity.yml` runs `tools/` as its own
 * vitest project, and the guards' original home note is right that pulling them into it widens
 * their blast radius for no gain. `src/main/**` is already where these guards live, and
 * `tsconfig.main.json` typechecks it — a `tools/` `.mjs` module would be typechecked by nothing.
 *
 * `stripComments` is **not** shared: `i18n-guards` documents a deliberate divergence in its copy.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

export type FileEntry = { path: string; source: string };

/**
 * `.claude` is skipped wholesale, not just `.claude/worktrees`: it holds only local,
 * git-excluded agent/session state (`.claude/launch.json` is gitignored dev-server config;
 * `.claude/worktrees/*` are full sibling copies of this repo's source tree used by other agent
 * sessions) — nothing under it is committed application source a guard should ever scan. Without
 * it a repo-root walk descends into every sibling copy and can trip a guard against a file that
 * is not part of this working tree at all.
 *
 * `.next-dev` is where `next dev` writes; `.next` is where `next build` writes. Both are build
 * output — see `apps/web/next.config.ts` for why they are separate directories.
 */
const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set([
  'node_modules',
  'out',
  'dist',
  '.next',
  '.next-dev',
  '.claude',
]);

export function isTestFile(path: string): boolean {
  return /\.(test|spec)\.(ts|tsx|mjs)$/.test(path);
}

export function walk(dir: string, extensions: readonly string[]): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      files.push(...walk(full, extensions));
    } else if (entry.isFile() && extensions.includes(extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Binds a guard file's own path so its `readAll` calls read the way they always have. Every guard
 * excludes itself: their red-state fixtures contain the forbidden shapes as plain string
 * literals, which would otherwise flag each guard against itself.
 */
export function guardScanner(selfPath: string): {
  readAll: (
    dir: string,
    extensions: readonly string[],
    opts?: { includeTests?: boolean },
  ) => FileEntry[];
} {
  return {
    readAll(dir, extensions, opts = {}) {
      return walk(dir, extensions)
        .filter((path) => path !== selfPath)
        .filter((path) => (opts.includeTests ? true : !isTestFile(path)))
        .map((path) => ({ path, source: readFileSync(path, 'utf8') }));
    },
  };
}
