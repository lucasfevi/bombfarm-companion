import { useCopy } from '../../lib/copy';
import type { LiveFieldCountdownModel } from '../../lib/live/live-model';
import { CountdownValue } from './countdown-value';
import { formatLiveDurationSeconds } from './format-live-duration';

export function FieldCountdown({ testId, model }: { testId: string; model: LiveFieldCountdownModel | undefined }) {
  const t = useCopy();

  if (!model) {
    return <span data-testid={testId}>{t.fidelityStatusMissing}</span>;
  }

  return (
    <CountdownValue
      testId={testId}
      formatted={formatLiveDurationSeconds(model.secondsRemaining)}
      qualified={model.basis === 'modelled'}
      qualifier={t.liveCountdownEstimatedQualifier}
    />
  );
}
