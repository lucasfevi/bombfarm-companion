import { describe, expect, it, vi } from 'vitest';
import {
  ElectronBinaryMissingAfterExtractError,
  ElectronExtractionTimeoutError,
  EXTRACTION_TIMEOUT_MS,
  extractElectronBinary,
  isRunAsEntryPoint,
} from './ensure-electron.mjs';

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

describe('isRunAsEntryPoint', () => {
  it('returns true and stays silent when argv[1] resolves to the same real path as the module', () => {
    const onSkippedEntryPoint = vi.fn();
    const result = isRunAsEntryPoint({
      importMetaUrl: 'file:///C:/repo/apps/desktop/scripts/ensure-electron.mjs',
      argv1: 'C:/repo/apps/desktop/scripts/ensure-electron.mjs',
      realpathSync: (p) => p.replace(/\\/g, '/').toLowerCase(),
      onSkippedEntryPoint,
    });

    expect(result).toBe(true);
    expect(onSkippedEntryPoint).not.toHaveBeenCalled();
  });

  it('returns false and stays silent when argv[1] is absent (a plain import, e.g. a test)', () => {
    const onSkippedEntryPoint = vi.fn();
    const result = isRunAsEntryPoint({
      importMetaUrl: 'file:///C:/repo/apps/desktop/scripts/ensure-electron.mjs',
      argv1: undefined,
      realpathSync: vi.fn(),
      onSkippedEntryPoint,
    });

    expect(result).toBe(false);
    expect(onSkippedEntryPoint).not.toHaveBeenCalled();
  });

  it('returns false and logs a clear message when argv[1] is present but resolves to a different real path', () => {
    const onSkippedEntryPoint = vi.fn();
    const realpathSync = (p) =>
      p.includes('ensure-electron.mjs') ? 'C:/real/ensure-electron.mjs' : 'C:/real/some-other-entry.mjs';

    const result = isRunAsEntryPoint({
      importMetaUrl: 'file:///C:/repo/apps/desktop/scripts/ensure-electron.mjs',
      argv1: 'C:/repo/apps/desktop/scripts/some-other-entry.mjs',
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
      if (p.includes('ensure-electron.mjs')) return 'C:/real/ensure-electron.mjs';
      throw new Error('ENOENT');
    };

    const result = isRunAsEntryPoint({
      importMetaUrl: 'file:///C:/repo/apps/desktop/scripts/ensure-electron.mjs',
      argv1: 'C:/gone/entry.mjs',
      realpathSync,
      onSkippedEntryPoint,
    });

    expect(result).toBe(false);
    expect(onSkippedEntryPoint).toHaveBeenCalledTimes(1);
  });
});
