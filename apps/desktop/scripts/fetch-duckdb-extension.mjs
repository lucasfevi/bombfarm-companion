import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..');

/** Where the build leaves the extension; `extraResources` ships this folder as `resources/duckdb`. */
export const EXTENSION_BUILD_DIR = path.join(desktopRoot, 'build', 'duckdb');

export class DuckdbExtensionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DuckdbExtensionError';
  }
}

/** The platform the shipped app is built for; packaging always asks for this one. */
export const PACKAGING_PLATFORM = 'windows_amd64';

/** DuckDB's name for the platform this process runs on, or null when no extension is pinned for it. */
export function currentExtensionPlatform(platform = process.platform, arch = process.arch) {
  if (platform === 'win32' && arch === 'x64') return 'windows_amd64';
  if (platform === 'linux' && arch === 'x64') return 'linux_amd64';
  return null;
}

/**
 * The one place the extension's DuckDB version and checksums are pinned. Each `sha256` is the
 * *decompressed* file's. Bumping DuckDB means bumping this file and the exact
 * `@duckdb/node-api` version together; the pin test fails when only one moves.
 *
 * @typedef {{ version: string, platform: string, extension: string, sha256: string }} DuckdbExtensionPin
 * @param {string} [platform] defaults to the packaging platform
 * @returns {DuckdbExtensionPin}
 */
export function readDuckdbExtensionPin(platform = PACKAGING_PLATFORM) {
  const file = JSON.parse(readFileSync(path.join(__dirname, 'duckdb-extension.json'), 'utf8'));
  const sha256 = file.sha256[platform];
  if (typeof sha256 !== 'string') {
    throw new DuckdbExtensionError(`No DuckDB extension is pinned for ${platform}.`);
  }
  return { version: file.version, platform, extension: file.extension, sha256 };
}

export function extensionFileName(pin) {
  return `${pin.extension}.duckdb_extension`;
}

export function extensionDownloadUrl(pin) {
  return `https://extensions.duckdb.org/v${pin.version}/${pin.platform}/${extensionFileName(pin)}.gz`;
}

/** `@duckdb/node-api` versions are `<duckdb version>-r.<binding revision>`. */
export function duckdbVersionOfBinding(bindingVersion) {
  const match = /^(\d+\.\d+\.\d+)-r\.\d+$/.exec(bindingVersion);
  if (match === null) {
    throw new DuckdbExtensionError(
      `"${bindingVersion}" is not an exact "@duckdb/node-api" version of the form "<x.y.z>-r.<n>".`,
    );
  }
  return match[1];
}

/** The extension is only loadable by the DuckDB build it was compiled for. */
export function assertPinsAgree(bindingVersion, pin) {
  const engine = duckdbVersionOfBinding(bindingVersion);
  if (engine !== pin.version) {
    throw new DuckdbExtensionError(
      `The DuckDB binding "${bindingVersion}" embeds DuckDB ${engine} but the extension is pinned to ${pin.version}. Bump both together.`,
    );
  }
}

export function sha256Of(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Downloads the pinned, signed extension into `outDir`, verifying the decompressed checksum.
 * A file already there with the pinned checksum is kept, so a rebuild needs no network.
 *
 * @param {{ pin?: DuckdbExtensionPin, outDir?: string, fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<string>} the extension's path
 */
export async function fetchDuckdbExtension({
  pin = readDuckdbExtensionPin(),
  outDir = EXTENSION_BUILD_DIR,
  fetchImpl = fetch,
} = {}) {
  const target = path.join(outDir, extensionFileName(pin));
  if (existsSync(target) && sha256Of(readFileSync(target)) === pin.sha256) {
    return target;
  }

  const url = extensionDownloadUrl(pin);
  let response;
  try {
    response = await fetchImpl(url);
  } catch (error) {
    throw new DuckdbExtensionError(
      `Could not download the DuckDB extension from ${url}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    throw new DuckdbExtensionError(`Could not download the DuckDB extension from ${url}: HTTP ${response.status}.`);
  }

  let bytes;
  try {
    bytes = gunzipSync(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    throw new DuckdbExtensionError(
      `The download from ${url} is not a gzip file: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const actual = sha256Of(bytes);
  if (actual !== pin.sha256) {
    throw new DuckdbExtensionError(
      `The DuckDB extension from ${url} has sha256 ${actual}, but ${pin.sha256} is pinned. Nothing was written.`,
    );
  }

  mkdirSync(outDir, { recursive: true });
  const partial = `${target}.partial`;
  writeFileSync(partial, bytes);
  rmSync(target, { force: true });
  renameSync(partial, target);
  return target;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const file = await fetchDuckdbExtension();
    console.log(`DuckDB extension ready: ${file}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
