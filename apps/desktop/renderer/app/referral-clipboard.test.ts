import { afterEach, describe, expect, it, vi } from 'vitest';
import { REFERRAL_CODE } from '@bombfarm/domain/referral';
import { copyReferralCode } from './referral-clipboard';

/**
 * The suite runs in node, so the browser APIs this module reaches for are installed per test.
 * Stubbing them is what makes the fallback observable: a test that only asserted the returned
 * status would pass with the selection code deleted.
 */
function stubClipboard(writeText: (value: string) => Promise<void>) {
  const spy = vi.fn(writeText);
  vi.stubGlobal('navigator', { clipboard: { writeText: spy } });
  return spy;
}

const refused = () => Promise.reject(new Error('denied'));
const accepted = () => Promise.resolve();

function stubSelectionApis() {
  const range = { selectNodeContents: vi.fn() };
  const selection = { removeAllRanges: vi.fn(), addRange: vi.fn() };
  vi.stubGlobal('document', { createRange: vi.fn(() => range) });
  vi.stubGlobal('window', { getSelection: vi.fn(() => selection) });
  return { range, selection };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('copyReferralCode — the clipboard succeeds', () => {
  it('writes the shared code verbatim, and nothing else', async () => {
    const writeText = stubClipboard(accepted);

    const status = await copyReferralCode(null);

    expect(status).toBe('copied');
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(REFERRAL_CODE);
  });

  it('leaves the selection alone — nothing to fall back to', async () => {
    stubClipboard(accepted);
    const { range } = stubSelectionApis();

    await copyReferralCode({} as HTMLElement);

    expect(range.selectNodeContents).not.toHaveBeenCalled();
  });
});

describe('copyReferralCode — the clipboard is refused', () => {
  it('selects the code in place instead of leaving the click with no effect', async () => {
    stubClipboard(refused);
    const { range, selection } = stubSelectionApis();
    const codeNode = {} as HTMLElement;

    const status = await copyReferralCode(codeNode);

    expect(status).toBe('manual');
    expect(range.selectNodeContents).toHaveBeenCalledWith(codeNode);
    expect(selection.removeAllRanges).toHaveBeenCalledTimes(1);
    expect(selection.addRange).toHaveBeenCalledWith(range);
  });

  it('resolves rather than rejecting, so a refusal is an outcome and not an unhandled error', async () => {
    stubClipboard(refused);
    stubSelectionApis();

    await expect(copyReferralCode(null)).resolves.toBe('manual');
  });

  it('reports manual even when there is no node to select', async () => {
    stubClipboard(refused);
    const { range } = stubSelectionApis();

    expect(await copyReferralCode(null)).toBe('manual');
    expect(range.selectNodeContents).not.toHaveBeenCalled();
  });
});
