import { useCopy } from '../../lib/copy';
import type { LiveRecoveryCountdownModel } from '../../lib/live/live-model';
import { CountdownValue } from './countdown-value';
import { formatLiveDurationSeconds } from './format-live-duration';

export function RecoveryCountdown({ testId, model }: { testId: string; model: LiveRecoveryCountdownModel | undefined }) {
  const t = useCopy();

  if (!model) {
    return <span data-testid={testId}>{t.fidelityStatusMissing}</span>;
  }

  return (
    <CountdownValue
      testId={testId}
      formatted={formatLiveDurationSeconds(model.secondsRemaining)}
      qualified={!model.advancing}
      qualifier={t.liveCountdownPausedQualifier}
    />
  );
}
