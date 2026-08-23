import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  ElectronBinaryMissingAfterExtractError,
  ElectronExtractionTimeoutError,
  EXTRACTION_TIMEOUT_MS,
  extractElectronBinary,
  isRunAsEntryPoint,
} from './ensure-electron.mjs';

const fakeTarPath = path.resolve('fake/bin/tar');
const fakeZip = path.resolve('fake/electron.zip');
const fakeDist = path.resolve('fake/dist');
const fakeElectronExe = path.join(fakeDist, 'electron');

describe('extractElectronBinary', () => {
  it('rejects with a timeout error instead of hanging when extraction never settles', async () => {
    const neverSettles = () => new Promise(() => {});

    await expect(
      extractElectronBinary({
        zip: 'C:/fake/electron.zip',
        dist: 'C:/fake/dist',
        electronExe: 'C:/fake/dist/electron.exe',
        extractFn: neverSettles,
        exists: () => true,
        timeoutMs: 20,
      }),
    ).rejects.toThrow(ElectronExtractionTimeoutError);
  });

  it('throws a clear error when extraction completes but the binary is missing', async () => {
    const resolvesEmpty = vi.fn().mockResolvedValue(undefined);

    await expect(
      extractElectronBinary({
        zip: 'C:/fake/electron.zip',
        dist: 'C:/fake/dist',
        electronExe: 'C:/fake/dist/electron.exe',
        extractFn: resolvesEmpty,
        exists: () => false,
        timeoutMs: 20,
      }),
    ).rejects.toThrow(ElectronBinaryMissingAfterExtractError);

    expect(resolvesEmpty).toHaveBeenCalledWith('C:/fake/electron.zip', {
      dir: 'C:/fake/dist',
    });
  });

  it('resolves without throwing when extraction succeeds and the binary is present', async () => {
    await expect(
      extractElectronBinary({
        zip: 'C:/fake/electron.zip',
        dist: 'C:/fake/dist',
        electronExe: 'C:/fake/dist/electron.exe',
        extractFn: vi.fn().mockResolvedValue(undefined),
        exists: () => true,
        timeoutMs: 20,
      }),
    ).resolves.toBeUndefined();
  });

  it('clears the watchdog timer on success so a fast run does not keep the process alive', async () => {
    vi.useFakeTimers();
    try {
      await extractElectronBinary({
        zip: 'C:/fake/electron.zip',
        dist: 'C:/fake/dist',
        electronExe: 'C:/fake/dist/electron.exe',
        extractFn: vi.fn().mockResolvedValue(undefined),
        exists: () => true,
        timeoutMs: EXTRACTION_TIMEOUT_MS,
      });

      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('extractElectronBinary OS tar preference', () => {
  it('uses the OS extractor and never calls extract-zip when bsdtar is detected', async () => {
    const probeTar = vi.fn().mockResolvedValue('bsdtar 3.8.4 - libarchive 3.8.4 zlib/1.3.1');
    const extractWithTar = vi.fn().mockResolvedValue(undefined);
    const extractFn = vi.fn().mockResolvedValue(undefined);

    await expect(
      extractElectronBinary({
        zip: fakeZip,
        dist: fakeDist,
        electronExe: fakeElectronExe,
        tarPath: fakeTarPath,
        probeTar,
        extractWithTar,
        extractFn,
        exists: () => true,
        timeoutMs: EXTRACTION_TIMEOUT_MS,
      }),
    ).resolves.toBeUndefined();

    expect(probeTar).toHaveBeenCalledWith(fakeTarPath);
    expect(extractWithTar).toHaveBeenCalledWith({ tarPath: fakeTarPath, zip: fakeZip, dist: fakeDist });
    expect(extractFn).not.toHaveBeenCalled();
  });

  it('falls back to extract-zip when the probe reports GNU tar', async () => {
    const probeTar = vi.fn().mockResolvedValue('tar (GNU tar) 1.34\nCopyright (C) 2021 Free Software Foundation, Inc.');
    const extractWithTar = vi.fn().mockResolvedValue(undefined);
    const extractFn = vi.fn().mockResolvedValue(undefined);

    await expect(
      extractElectronBinary({
        zip: fakeZip,
        dist: fakeDist,
        electronExe: fakeElectronExe,
        tarPath: fakeTarPath,
        probeTar,
        extractWithTar,
        extractFn,
        exists: () => true,
        timeoutMs: EXTRACTION_TIMEOUT_MS,
      }),
    ).resolves.toBeUndefined();

    expect(extractWithTar).not.toHaveBeenCalled();
    expect(extractFn).toHaveBeenCalledWith(fakeZip, { dir: fakeDist });
  });

  it('falls back to extract-zip when no tar is available at all', async () => {
    const probeTar = vi.fn().mockRejectedValue(new Error('spawn tar ENOENT'));
    const extractWithTar = vi.fn().mockResolvedValue(undefined);
    const extractFn = vi.fn().mockResolvedValue(undefined);

    await expect(
      extractElectronBinary({
        zip: fakeZip,
        dist: fakeDist,
        electronExe: fakeElectronExe,
        tarPath: fakeTarPath,
        probeTar,
        extractWithTar,
        extractFn,
        exists: () => true,
        timeoutMs: EXTRACTION_TIMEOUT_MS,
      }),
    ).resolves.toBeUndefined();

    expect(extractWithTar).not.toHaveBeenCalled();
    expect(extractFn).toHaveBeenCalledWith(fakeZip, { dir: fakeDist });
  });

  it('falls back to extract-zip when the OS extractor exits non-zero', async () => {
    const probeTar = vi.fn().mockResolvedValue('bsdtar 3.8.4 - libarchive 3.8.4 zlib/1.3.1');
    const extractWithTar = vi.fn().mockRejectedValue(new Error('tar extraction exited with code 1'));
    const extractFn = vi.fn().mockResolvedValue(undefined);

    await expect(
      extractElectronBinary({
        zip: fakeZip,
        dist: fakeDist,
        electronExe: fakeElectronExe,
        tarPath: fakeTarPath,
        probeTar,
        extractWithTar,
        extractFn,
        exists: () => true,
        timeoutMs: EXTRACTION_TIMEOUT_MS,
      }),
    ).resolves.toBeUndefined();

    expect(extractWithTar).toHaveBeenCalledTimes(1);
    expect(extractFn).toHaveBeenCalledWith(fakeZip, { dir: fakeDist });
  });

  it('throws a clear error when the binary is still missing after a successful OS-tar extraction', async () => {
    const probeTar = vi.fn().mockResolvedValue('bsdtar 3.8.4 - libarchive 3.8.4 zlib/1.3.1');
    const extractWithTar = vi.fn().mockResolvedValue(undefined);
    const extractFn = vi.fn().mockResolvedValue(undefined);

    await expect(
      extractElectronBinary({
        zip: fakeZip,
        dist: fakeDist,
        electronExe: fakeElectronExe,
        tarPath: fakeTarPath,
        probeTar,
        extractWithTar,
        extractFn,
        exists: () => false,
        timeoutMs: EXTRACTION_TIMEOUT_MS,
      }),
    ).rejects.toThrow(ElectronBinaryMissingAfterExtractError);

    expect(extractWithTar).toHaveBeenCalledTimes(1);
    expect(extractFn).not.toHaveBeenCalled();
  });

  it('rejects with a timeout error instead of hanging when the OS extractor stalls', async () => {
    const probeTar = vi.fn().mockResolvedValue('bsdtar 3.8.4 - libarchive 3.8.4 zlib/1.3.1');
    const extractWithTar = vi.fn(() => new Promise(() => {}));
    const extractFn = vi.fn().mockResolvedValue(undefined);

    await expect(
      extractElectronBinary({
        zip: fakeZip,
        dist: fakeDist,
        electronExe: fakeElectronExe,
        tarPath: fakeTarPath,
        probeTar,
        extractWithTar,
        extractFn,
        exists: () => true,
        timeoutMs: 20,
      }),
    ).rejects.toThrow(ElectronExtractionTimeoutError);

    expect(extractFn).not.toHaveBeenCalled();
  });

  it('does not probe for or invoke the OS extractor when tarPath/probeTar are not provided', async () => {
    const extractWithTar = vi.fn().mockResolvedValue(undefined);
    const extractFn = vi.fn().mockResolvedValue(undefined);

    await expect(
      extractElectronBinary({
        zip: fakeZip,
        dist: fakeDist,
        electronExe: fakeElectronExe,
        extractWithTar,
        extractFn,
        exists: () => true,
        timeoutMs: EXTRACTION_TIMEOUT_MS,
      }),
    ).resolves.toBeUndefined();

    expect(extractWithTar).not.toHaveBeenCalled();
    expect(extractFn).toHaveBeenCalledWith(fakeZip, { dir: fakeDist });
  });
});

describe('isRunAsEntryPoint', () => {
  // Derived from the running platform: a driveless `file:///repo/...` URL is not a valid
  // Windows file URL, and a `file:///C:/...` one does not round-trip on POSIX.
  const modulePath = path.resolve('repo/apps/desktop/scripts/ensure-electron.mjs');
  const moduleUrl = pathToFileURL(modulePath).href;
  const otherEntryPath = path.resolve('repo/apps/desktop/scripts/some-other-entry.mjs');
  const missingEntryPath = path.resolve('gone/entry.mjs');

  it('returns true and stays silent when argv[1] resolves to the same real path as the module', () => {
    const onSkippedEntryPoint = vi.fn();
    const result = isRunAsEntryPoint({
      importMetaUrl: moduleUrl,
      argv1: modulePath,
      realpathSync: (p) => p,
      onSkippedEntryPoint,
    });

    expect(result).toBe(true);
    expect(onSkippedEntryPoint).not.toHaveBeenCalled();
  });

  it('returns false and stays silent when argv[1] is absent (a plain import, e.g. a test)', () => {
    const onSkippedEntryPoint = vi.fn();
    const result = isRunAsEntryPoint({
      importMetaUrl: moduleUrl,
      argv1: undefined,
      realpathSync: vi.fn(),
      onSkippedEntryPoint,
    });

    expect(result).toBe(false);
    expect(onSkippedEntryPoint).not.toHaveBeenCalled();
  });

  it('returns false and logs a clear message when argv[1] is present but resolves to a different real path', () => {
    const onSkippedEntryPoint = vi.fn();
    const realpathSync = (p) => p;

    const result = isRunAsEntryPoint({
      importMetaUrl: moduleUrl,
      argv1: otherEntryPath,
      realpathSync,
      onSkippedEntryPoint,
    });

    expect(result).toBe(false);
    expect(onSkippedEntryPoint).toHaveBeenCalledTimes(1);
    const [message] = onSkippedEntryPoint.mock.calls[0];
    expect(message).toContain('ensure-electron.mjs');
    expect(message).toContain('did not run as the entry point');
  });

  it('falls back to a resolved path and still reports a mismatch when argv[1] cannot be realpath-resolved', () => {
    const onSkippedEntryPoint = vi.fn();
    const realpathSync = (p) => {
      if (p.includes('ensure-electron.mjs')) return p;
      throw new Error('ENOENT');
    };

    const result = isRunAsEntryPoint({
      importMetaUrl: moduleUrl,
      argv1: missingEntryPath,
      realpathSync,
      onSkippedEntryPoint,
    });

    expect(result).toBe(false);
    expect(onSkippedEntryPoint).toHaveBeenCalledTimes(1);
  });
});
