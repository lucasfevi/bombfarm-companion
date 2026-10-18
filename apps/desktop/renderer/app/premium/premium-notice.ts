import type { PremiumActionResult } from '@bombfarm/contracts';

export type PremiumNotice = 'too-soon' | 'manage-failed';

export function noticeAfterRefresh(result: PremiumActionResult): PremiumNotice | null {
  return !result.ok && result.reason === 'too-soon' ? 'too-soon' : null;
}

export function noticeAfterManage(result: PremiumActionResult): PremiumNotice | null {
  return result.ok ? null : 'manage-failed';
}
