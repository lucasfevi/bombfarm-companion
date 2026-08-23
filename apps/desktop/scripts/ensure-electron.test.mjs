import { describe, expect, it, vi } from 'vitest';
import {
  ElectronBinaryMissingAfterExtractError,
  ElectronExtractionTimeoutError,
  EXTRACTION_TIMEOUT_MS,
  extractElectronBinary,
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
