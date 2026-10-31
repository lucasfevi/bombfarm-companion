import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { AppFlavor, PremiumManifest } from '@bombfarm/contracts';
import { BUNDLE_MAX_FILES, parseLocalManifest, verifyFiles, verifyFit, type VerifyReason } from './bundle-verify.js';

/**
 * A local Premium build for development: a folder with an unsigned manifest. It is read once, then
 * held in memory like any other bundle. The paths, layout and file hashes are checked as for a
 * downloaded bundle and so is the fit; the signature and freshness are skipped, and nothing is
 * written to the cache. This file is compiled into dev builds only, reached through the loader.
 */

export type LocalBundleReason = VerifyReason | 'unreadable';

export interface LocalBundle {
  readonly manifest: PremiumManifest;
  readonly files: ReadonlyMap<string, Uint8Array>;
}

export type LocalBundleResult =
  | { readonly ok: true; readonly bundle: LocalBundle }
  | { readonly ok: false; readonly reason: LocalBundleReason };

export interface LocalBundleContext {
  readonly hostApi: string;
  readonly appVersion: string;
  readonly flavor: AppFlavor;
}

const MANIFEST_FILE = 'manifest.json';
/** A signature next to the manifest is not part of the bundle; a local build has none and none is read. */
const SIGNATURE_FILE = 'manifest.sig';
const FILE_BYTES_LIMIT = 4 * 1024 * 1024;
/** More entries than any bundle may hold; a folder past it is not read. */
const ENTRY_LIMIT = 4 * BUNDLE_MAX_FILES;

/** Every file under `dir` as a slash-separated path, or null past the entry limit. */
async function listFiles(dir: string, prefix: string, out: string[]): Promise<boolean> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!(await listFiles(join(dir, entry.name), rel, out))) return false;
    } else if (entry.isFile()) {
      if (out.length >= ENTRY_LIMIT) return false;
      out.push(rel);
    }
  }
  return true;
}

export async function readLocalBundle(dir: string, ctx: LocalBundleContext): Promise<LocalBundleResult> {
  let manifestBytes: Uint8Array;
  const names: string[] = [];
  try {
    manifestBytes = await readFile(join(dir, MANIFEST_FILE));
    if (!(await listFiles(dir, '', names))) return { ok: false, reason: 'bad_layout' };
  } catch {
    return { ok: false, reason: 'unreadable' };
  }

  const manifest = parseLocalManifest(manifestBytes);
  if (manifest === null || manifest.sequence !== 0) return { ok: false, reason: 'bad_manifest' };

  // The shape is judged on names alone, so a path that is not safe never reaches the disk.
  const present = new Map(names.filter((name) => name !== MANIFEST_FILE && name !== SIGNATURE_FILE).map((name): [string, Uint8Array] => [name, new Uint8Array()]));
  const shape = verifyFiles(manifest, present);
  if (!shape.ok && shape.reason !== 'file_mismatch') return shape;

  const files = new Map<string, Uint8Array>();
  try {
    for (const { path } of manifest.files) {
      const target = join(dir, ...path.split('/'));
      if ((await stat(target)).size > FILE_BYTES_LIMIT) return { ok: false, reason: 'too_large' };
      files.set(path, await readFile(target));
    }
  } catch {
    return { ok: false, reason: 'file_mismatch' };
  }

  const checked = verifyFiles(manifest, files);
  if (!checked.ok) return checked;
  const fits = verifyFit(manifest, ctx);
  if (!fits.ok) return fits;
  return { ok: true, bundle: { manifest, files } };
}
