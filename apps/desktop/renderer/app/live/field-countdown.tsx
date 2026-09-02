import { useCopy } from '../../lib/copy';
import type { LiveFieldCountdownModel } from '../../lib/live/live-model';
import { CountdownAbsentValue, CountdownValue, type CountdownSize } from './countdown-value';
import { formatLiveDurationSeconds } from './format-live-duration';

export function FieldCountdown({
  testId,
  model,
  size = 'default',
}: {
  testId: string;
  model: LiveFieldCountdownModel | undefined;
  size?: CountdownSize;
}) {
  const t = useCopy();

  if (!model) {
    return <CountdownAbsentValue testId={testId} label={t.valueNotAvailable} size={size} />;
  }

  return (
    <CountdownValue
      testId={testId}
      formatted={formatLiveDurationSeconds(model.secondsRemaining)}
      qualified={model.basis === 'modelled'}
      qualifier={t.liveCountdownEstimatedQualifier}
      size={size}
    />
  );
}
