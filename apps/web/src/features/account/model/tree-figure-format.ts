import { formatNumber, type Lang } from '@/shared/lib/format-number';

export function formatTreePercent(value: number, lang: Lang): string {
  return `+${formatNumber(value, lang, 2)}%`;
}

export function formatLuckPoints(value: number, lang: Lang): string {
  return `+${formatNumber(value, lang, 2)} pp`;
}
