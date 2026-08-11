'use client';

import { useCallback, useRef } from 'react';
import type { Strings } from '@/shared/i18n';
import { REFERRAL_CODE } from '@/shared/referral';
import { usePlannerStore } from '@/shared/stores';

/**
 * Copy-the-referral-code behaviour, shared by the header chip and the footer line.
 *
 * Attach `codeRef` to the element rendering the code. When the clipboard is
 * unavailable — insecure origin, or a denied permission — `copy` selects that
 * element's text and says so, rather than leaving the click with no visible
 * effect. Callers that render the code inside the button itself can point
 * `codeRef` at the inner node.
 */
export function useReferralCopy(strings: Strings) {
  const codeRef = useRef<HTMLElement>(null);
  const flashToast = usePlannerStore((state) => state.flashToast);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(REFERRAL_CODE);
      flashToast(strings.referralCopied);
      return;
    } catch {
      /* fall through to manual selection */
    }
    const code = codeRef.current;
    if (!code) return;
    const range = document.createRange();
    range.selectNodeContents(code);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    flashToast(strings.referralCopyManual);
  }, [flashToast, strings.referralCopied, strings.referralCopyManual]);

  return { codeRef, copy };
}
