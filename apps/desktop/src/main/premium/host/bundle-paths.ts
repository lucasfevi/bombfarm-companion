import { posix } from 'node:path';

export type BundlePathVerdict = 'ok' | 'bad_path';

// eslint-disable-next-line no-control-regex -- control characters are exactly what is refused
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const ALLOWED_CHARS = /^[A-Za-z0-9._/-]+$/;
const DRIVE_LETTER = /^[A-Za-z]:/;

/**
 * Whether a manifest file path is safe to use as a bundle-relative path and, unencoded, as a URL
 * path. The same refusals as the renderer file resolver, plus a character set.
 */
export function checkBundlePath(p: string): BundlePathVerdict {
  if (p === '') return 'bad_path';
  if (CONTROL_CHARS.test(p)) return 'bad_path';
  if (p.startsWith('/') || p.endsWith('/') ||p.includes('\\') || DRIVE_LETTER.test(p)) return 'bad_path';
  if (p.includes('%') || !ALLOWED_CHARS.test(p)) return 'bad_path';
  if (p.split('/').some((segment) => segment === '..' || segment === '.')) return 'bad_path';
  if (posix.normalize(p) !== p) return 'bad_path';
  return 'ok';
}
