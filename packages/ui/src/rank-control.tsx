import { Button as BaseButton } from '@base-ui/react/button';
import {
  rankCtlBtnClass,
  rankCtlClass,
  rankCtlLvClass,
  rankCtlMaxClass,
  rankCtlReadoutClass,
  rankCtlValueClass,
} from './stepper.recipe';
import { cn } from './cn';

export function RankControl({
  value,
  max,
  onChange,
  disabledInc,
  disabledDec,
  label,
  lvLabel = 'Lv',
  className,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
  disabledInc?: boolean;
  disabledDec?: boolean;
  /** Accessible name for the control group. */
  label: string;
  lvLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn(rankCtlClass, className)} role="group" aria-label={label}>
      <BaseButton
        type="button"
        className={rankCtlBtnClass}
        disabled={disabledDec ?? value <= 0}
        onClick={() => onChange(value - 1)}
        aria-label={`${label} −1`}
      >
        −
      </BaseButton>
      <span className={rankCtlReadoutClass} aria-live="polite">
        <span className={rankCtlLvClass}>{lvLabel}</span>
        <b className={rankCtlValueClass}>{value}</b>
        <span className={rankCtlMaxClass}>/{max}</span>
      </span>
      <BaseButton
        type="button"
        className={rankCtlBtnClass}
        disabled={disabledInc ?? value >= max}
        onClick={() => onChange(value + 1)}
        aria-label={`${label} +1`}
      >
        +
      </BaseButton>
    </div>
  );
}
