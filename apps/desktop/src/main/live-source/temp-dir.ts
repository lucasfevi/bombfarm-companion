import fs from 'node:fs';
import path from 'node:path';
import type { LogPort } from './runtime.js';

/**
 * The instrumentation runtime stages its injection helper in a fresh directory under the system
 * temp folder, and it finds that folder through the C library's lookup: `TMPDIR`, then `TMP`,
 * then `TEMP`, first one set wins. A machine whose temp variables point somewhere the app cannot
 * write — one activation cracker is known to rewrite them to its own folder under Program Files —
 * fails every attach with "Error creating directory …: Permission denied" and nothing the app
 * shows explains it. This runs once before the runtime's first attach and, when the folder the
 * runtime would use is not writable, points all three variables at a folder under the app's own
 * user data, which is writable by construction. Before the first attach is the only time it can
 * work: the runtime resolves the folder once, on that attach, and keeps the answer for the life
 * of the process — measured, a redirect after a failed attach changes nothing.
 */
const TEMP_VARS = ['TMPDIR', 'TMP', 'TEMP'] as const;

export interface TempDirDeps {
  readonly env: Record<string, string | undefined>;
  readonly fallbackDir: string;
  readonly log: LogPort;
  readonly isWritable?: (dir: string) => boolean;
}

export type TempDirOutcome =
  | { readonly kind: 'kept'; readonly dir: string | undefined }
  | { readonly kind: 'redirected'; readonly from: string | undefined; readonly to: string }
  | { readonly kind: 'unwritable'; readonly from: string | undefined; readonly fallback: string };

export function effectiveTempDir(env: Record<string, string | undefined>): string | undefined {
  for (const name of TEMP_VARS) {
    const value = env[name];
    if (value !== undefined && value !== '') return value;
  }
  return undefined;
}

/** Creates the folder if it is missing, then proves it by creating and removing a directory in
 *  it — the runtime's own first write — so an existing-but-read-only folder fails here too. */
export function canCreateDirectoryIn(dir: string): boolean {
  let probe: string | undefined;
  try {
    fs.mkdirSync(dir, { recursive: true });
    probe = fs.mkdtempSync(path.join(dir, 'bfc-'));
    return true;
  } catch {
    return false;
  } finally {
    if (probe !== undefined) fs.rmSync(probe, { recursive: true, force: true });
  }
}

export function ensureWritableTempDir(deps: TempDirDeps): TempDirOutcome {
  const isWritable = deps.isWritable ?? canCreateDirectoryIn;
  const current = effectiveTempDir(deps.env);
  if (current !== undefined && isWritable(current)) return { kind: 'kept', dir: current };

  if (!isWritable(deps.fallbackDir)) {
    deps.log.info({ scope: 'live-source', event: 'temp.unwritable', from: current, fallback: deps.fallbackDir });
    return { kind: 'unwritable', from: current, fallback: deps.fallbackDir };
  }

  for (const name of TEMP_VARS) deps.env[name] = deps.fallbackDir;
  deps.log.info({ scope: 'live-source', event: 'temp.redirected', from: current, to: deps.fallbackDir });
  return { kind: 'redirected', from: current, to: deps.fallbackDir };
}
