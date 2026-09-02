/**
 * Writing the referral code to the clipboard, and what to do when that is refused.
 *
 * Separate from `referral-link.tsx` so the behaviour that matters — which value reaches the
 * clipboard, and that a refusal still leaves the code selected rather than failing silently — is
 * reachable without a DOM renderer. The component keeps only the React state around it.
 */
import { REFERRAL_CODE } from '@bombfarm/domain/referral';

export type CopyStatus = 'idle' | 'copied' | 'manual';

function selectContents(node: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/**
 * Resolves to the status the UI should show. Never rejects: a refused clipboard write is an
 * outcome the player is told about, not an error the caller has to handle.
 */
export async function copyReferralCode(codeNode: HTMLElement | null): Promise<CopyStatus> {
  try {
    await navigator.clipboard.writeText(REFERRAL_CODE);
    return 'copied';
  } catch {
    if (codeNode) selectContents(codeNode);
    return 'manual';
  }
}
