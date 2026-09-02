import { Panel, panelHClass, panelTitleClass, tipClass } from '@bombfarm/ui';

export interface AccountIdentityLabels {
  title: string;
  tip: string;
  playerName: string;
  accountId: string;
  currentPhase: string;
  maxPhase: string;
  /** Renders a phase number the way the host app writes phases; the view never sees a language. */
  phase: (phase: number) => string;
  /** Stands in for a fact the imported account did not carry. */
  missing: string;
}

export interface AccountIdentityViewProps {
  playerName: string | null;
  accountId: string | null;
  phase: number | null;
  maxPhase: number | null;
  labels: AccountIdentityLabels;
}

function IdentityFact({ label, value }: { label: string; value: string }) {
  return (
    <div data-account-fact className="min-w-0">
      <div className="text-[11px] leading-1.35 text-muted">{label}</div>
      <div className="truncate font-mono text-sm font-semibold text-ink tabular-nums">{value}</div>
    </div>
  );
}

/**
 * Who this account is and how far it has come — the four facts every panel below is scoped to.
 * All read-only and import-sourced; an account that carried no identity renders the placeholder
 * rather than a blank header, so "nothing imported yet" stays legible.
 */
export function AccountIdentityView({
  playerName,
  accountId,
  phase,
  maxPhase,
  labels,
}: AccountIdentityViewProps) {
  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{labels.title}</h2>
      </div>
      <p className={tipClass}>{labels.tip}</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 min-[560px]:grid-cols-4">
        <IdentityFact label={labels.playerName} value={playerName ?? labels.missing} />
        <IdentityFact label={labels.accountId} value={accountId ?? labels.missing} />
        <IdentityFact
          label={labels.currentPhase}
          value={phase != null ? labels.phase(phase) : labels.missing}
        />
        <IdentityFact
          label={labels.maxPhase}
          value={maxPhase != null ? labels.phase(maxPhase) : labels.missing}
        />
      </div>
    </Panel>
  );
}
