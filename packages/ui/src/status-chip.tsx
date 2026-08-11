import { chipRecipe, type ChipVariant } from './chip.recipe';
import { cn } from './cn';

/** INV-1 game-connection states — the single vocabulary every desktop surface reads. */
export type GameConnectionStatus = 'connected' | 'not_running' | 'stale';

export interface StatusChipProps {
  status: GameConnectionStatus;
  /** Caller-supplied, already-translated text — i18n stays out of the design system. */
  label: string;
  /** Preformatted duration (e.g. `"3m"`); only meaningful for `stale`. */
  ageLabel?: string;
  className?: string;
}

const STATUS_TONE: Record<GameConnectionStatus, ChipVariant> = {
  connected: 'small-active',
  stale: 'small-warn',
  not_running: 'small-muted',
};

/**
 * StatusChip — single implementation of INV-1 connection states (SHL-10..14).
 * Built on `chipRecipe` (reuses `small-active` / `small-warn`, extends with the
 * additive `small-muted` tone for `not_running`) rather than a parallel chip.
 * The dot is decorative and carries no text node so `role="status"` text stays
 * exactly the caller's `label` (the desktop smoke test asserts on it verbatim).
 */
export function StatusChip({ status, label, ageLabel, className }: StatusChipProps) {
  return (
    <span
      role="status"
      className={cn(chipRecipe({ variant: STATUS_TONE[status] }), 'inline-flex items-center gap-1.5', className)}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
      {label}
      {status === 'stale' && ageLabel ? <span className="text-muted">{ageLabel}</span> : null}
    </span>
  );
}
