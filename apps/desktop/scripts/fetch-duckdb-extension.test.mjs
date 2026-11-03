import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertPinsAgree,
  currentExtensionPlatform,
  DuckdbExtensionError,
  duckdbVersionOfBinding,
  extensionDownloadUrl,
  fetchDuckdbExtension,
  readDuckdbExtensionPin,
  sha256Of,
} from './fetch-duckdb-extension.mjs';

const tempDirs = [];
const makeTempDir = () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'bfc-duckdb-ext-'));
  tempDirs.push(dir);
  return dir;
};
afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop(), { recursive: true, force: true });
});

const payload = Buffer.from('a signed extension, pretend');
const pin = { version: '9.9.9', platform: 'windows_amd64', extension: 'httpfs', sha256: sha256Of(payload) };

const okResponse = (body) => ({ ok: true, status: 200, arrayBuffer: async () => body });
const fakeFetch = (respond) => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return respond(url);
  };
  return { fetchImpl, calls };
};

describe('fetchDuckdbExtension', () => {
  it('downloads from the official host for the pinned version and platform, and writes the decompressed file', async () => {
    const outDir = makeTempDir();
    const gz = gzipSync(payload);
    const { fetchImpl, calls } = fakeFetch(() => okResponse(gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.length)));

    const file = await fetchDuckdbExtension({ pin, outDir, fetchImpl });

    expect(calls).toEqual(['https://extensions.duckdb.org/v9.9.9/windows_amd64/httpfs.duckdb_extension.gz']);
    expect(path.basename(file)).toBe('httpfs.duckdb_extension');
    expect(readFileSync(file).equals(payload)).toBe(true);
    expect(readdirSync(outDir)).toEqual(['httpfs.duckdb_extension']);
  });

  it('fails on a sha mismatch and writes nothing', async () => {
    const outDir = makeTempDir();
    const tampered = gzipSync(Buffer.from('not the pinned bytes'));
    const { fetchImpl } = fakeFetch(() => okResponse(tampered));

    await expect(fetchDuckdbExtension({ pin, outDir, fetchImpl })).rejects.toThrow(DuckdbExtensionError);
    await expect(fetchDuckdbExtension({ pin, outDir, fetchImpl })).rejects.toThrow(/sha256/);
    expect(readdirSync(outDir)).toEqual([]);
  });

  it('fails when the download is missing (HTTP 404)', async () => {
    const outDir = makeTempDir();
    const { fetchImpl } = fakeFetch(() => ({ ok: false, status: 404 }));

    await expect(fetchDuckdbExtension({ pin, outDir, fetchImpl })).rejects.toThrow(/HTTP 404/);
    expect(readdirSync(outDir)).toEqual([]);
  });

  it('fails when the request itself fails', async () => {
    const outDir = makeTempDir();
    const { fetchImpl } = fakeFetch(() => {
      throw new Error('offline');
    });

    await expect(fetchDuckdbExtension({ pin, outDir, fetchImpl })).rejects.toThrow(/offline/);
  });

  it('fails on a body that is not gzip', async () => {
    const outDir = makeTempDir();
    const { fetchImpl } = fakeFetch(() => okResponse(Buffer.from('<html>')));

    await expect(fetchDuckdbExtension({ pin, outDir, fetchImpl })).rejects.toThrow(/gzip/);
  });

  it('keeps a file that already has the pinned checksum without downloading', async () => {
    const outDir = makeTempDir();
    writeFileSync(path.join(outDir, 'httpfs.duckdb_extension'), payload);
    const { fetchImpl, calls } = fakeFetch(() => ({ ok: false, status: 500 }));

    await fetchDuckdbExtension({ pin, outDir, fetchImpl });

    expect(calls).toEqual([]);
  });

  it('replaces a file whose checksum differs from the pin', async () => {
    const outDir = makeTempDir();
    writeFileSync(path.join(outDir, 'httpfs.duckdb_extension'), 'stale');
    const gz = gzipSync(payload);
    const { fetchImpl } = fakeFetch(() => okResponse(gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.length)));

    const file = await fetchDuckdbExtension({ pin, outDir, fetchImpl });

    expect(readFileSync(file).equals(payload)).toBe(true);
    expect(existsSync(`${file}.partial`)).toBe(false);
  });
});

describe('the DuckDB pins', () => {
  const desktopPackage = JSON.parse(
    readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'),
  );
  const realPin = readDuckdbExtensionPin();

  it('the extension version folder in the download URL equals the binding\'s DuckDB version', () => {
    const binding = desktopPackage.dependencies['@duckdb/node-api'];
    expect(binding).toMatch(/^\d+\.\d+\.\d+-r\.\d+$/); // exact, no range
    expect(() => assertPinsAgree(binding, realPin)).not.toThrow();
    expect(extensionDownloadUrl(realPin)).toContain(`/v${duckdbVersionOfBinding(binding)}/`);
  });

  it('fails when only the binding moves', () => {
    expect(() => assertPinsAgree('1.6.0-r.1', realPin)).toThrow(/Bump both together/);
  });

  it('fails when only the extension pin moves', () => {
    const binding = desktopPackage.dependencies['@duckdb/node-api'];
    expect(() => assertPinsAgree(binding, { ...realPin, version: '1.6.0' })).toThrow(/Bump both together/);
  });

  it('passes when a binding revision moves but DuckDB does not', () => {
    expect(() => assertPinsAgree('1.5.5-r.9', realPin)).not.toThrow();
  });

  it('rejects a range or tag in place of an exact binding version', () => {
    expect(() => duckdbVersionOfBinding('^1.5.5-r.4')).toThrow(DuckdbExtensionError);
  });

  it('pins a sha256 of the right shape', () => {
    expect(realPin.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('the per-platform pins', () => {
  it('pins a well-formed sha256 for the packaging platform and for Linux CI', () => {
    for (const platform of ['windows_amd64', 'linux_amd64']) {
      const pin = readDuckdbExtensionPin(platform);
      expect(pin.platform).toBe(platform);
      expect(pin.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(extensionDownloadUrl(pin)).toContain(`/${platform}/`);
    }
    expect(readDuckdbExtensionPin('windows_amd64').sha256).not.toBe(readDuckdbExtensionPin('linux_amd64').sha256);
  });

  it('defaults to the packaging platform and refuses an unpinned one', () => {
    expect(readDuckdbExtensionPin().platform).toBe('windows_amd64');
    expect(() => readDuckdbExtensionPin('osx_arm64')).toThrow(DuckdbExtensionError);
  });

  it('names the current platform, and none for an unpinned one', () => {
    expect(currentExtensionPlatform('win32', 'x64')).toBe('windows_amd64');
    expect(currentExtensionPlatform('linux', 'x64')).toBe('linux_amd64');
    expect(currentExtensionPlatform('darwin', 'arm64')).toBeNull();
    expect(currentExtensionPlatform('linux', 'arm64')).toBeNull();
  });
});
