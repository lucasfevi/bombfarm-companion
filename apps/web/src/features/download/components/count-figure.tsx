import { formatNumber } from '@bombfarm/ui';
import type { Lang } from '@/shared/i18n';

export function CountFigure({
  value,
  label,
  lang,
  testId,
  tone,
}: {
  value: number;
  label: string;
  lang: Lang;
  testId: string;
  tone: 'gold' | 'ink';
}) {
  return (
    <p className="m-0 flex items-baseline gap-3" data-testid={testId}>
      <span
        className={`font-mono text-[34px] leading-none font-semibold tracking-tight tabular-nums ${tone === 'gold' ? 'text-gold' : 'text-ink'}`}
      >
        {formatNumber(value, lang, 0)}
      </span>
      <span className="max-w-[22ch] text-[13px] leading-snug text-muted">{label}</span>
    </p>
  );
}
