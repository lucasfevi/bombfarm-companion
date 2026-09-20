'use client';

/**
 * The shared row shell every apply step draws through — this item's Equip and Reset rows, and the
 * forge row the batch-add item mounts through `ApplyPanel`'s seam. The shell's props and test ids
 * are the mount contract between the two items; nothing here may drift from them.
 */
import { useState, type ReactNode } from 'react';
import { Button } from '@bombfarm/ui';
import { sub, subNodes, useLocale, type Copy } from '../../lib/copy';
import { formatCount } from '../../lib/format';
import {
  APPLY_SKIP_REASON_COPY_KEY,
  APPLY_STOP_REASON_COPY_KEY,
  applyStartRefusalText,
  formatClock,
  type ApplyUnitLabel,
} from '../../lib/optimizer/apply-labels';
import { groupSkips, type ApplyStepId, type StepFacts, type StepGate } from '../../lib/optimizer/apply-panel-model';
import type { StepRecord, StopView } from '../../lib/optimizer/apply-progress-reducer';
import type { SkipRecord } from '../../lib/optimizer/apply-run-reducer';
import { ForgeGold } from '../forge/forge-gold';

export type ApplyStepRowAction =
  | { readonly label: string; readonly onPress: () => void; readonly disabled: boolean; readonly reason?: string }
  | { readonly done: string }
  | { readonly nothing: string };

export type ApplyStepRowProps = {
  readonly index: 1 | 2 | 3;
  readonly title: string;
  readonly facts: ReactNode;
  readonly notes?: readonly ReactNode[];
  readonly action: ApplyStepRowAction;
  readonly testId: string;
};

function stateOf(action: ApplyStepRowAction): 'ready' | 'done' | 'nothing' {
  if ('label' in action) return 'ready';
  if ('done' in action) return 'done';
  return 'nothing';
}

/** The shared shell — exactly the contract's props and test ids (spec § *Contract with the forge
 *  row*, item 2). The forge row (`forge-queue-batch-add`) composes over this same component. */
export function ApplyStepRow({ index, title, facts, notes, action, testId }: ApplyStepRowProps) {
  return (
    <div
      data-testid={testId}
      data-state={stateOf(action)}
      className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line py-3 last:border-b-0"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="m-0 text-sm font-semibold text-ink">
          <span className="mr-1.5 text-muted">{index}.</span>
          {title}
        </h3>
        <p data-testid={`${testId}-facts`} className="m-0 text-[13px] text-muted">
          {facts}
        </p>
        {'label' in action && action.reason !== undefined ? (
          <p data-testid={`${testId}-reason`} className="m-0 text-[12px] text-warn">
            {action.reason}
          </p>
        ) : null}
        {notes?.map((note, noteIndex) => (
          <p key={noteIndex} data-testid={`${testId}-note`} className="m-0 text-[12px] text-muted">
            {note}
          </p>
        ))}
      </div>
      <div className="shrink-0">
        {'label' in action ? (
          <Button type="button" variant="primary" data-testid={`${testId}-press`} disabled={action.disabled} onClick={action.onPress}>
            {action.label}
          </Button>
        ) : (
          <p data-testid={`${testId}-done`} className="m-0 text-[13px] text-ink">
            {'done' in action ? action.done : action.nothing}
          </p>
        )}
      </div>
    </div>
  );
}

/** Why a stopped step stopped, in the player's terms — a start refusal names what main refused;
 *  a run stop names why the run itself ended (never `finished`: that step reads `done`, not
 *  `stopped`). */
function stopReasonText(stop: StopView, t: Copy): string {
  if (stop.kind === 'start') return applyStartRefusalText(stop.reason, t);
  if (stop.stop === 'finished') return '';
  const text = t[APPLY_STOP_REASON_COPY_KEY[stop.stop]];
  return stop.stop === 'refused' && stop.code !== undefined ? sub(text, { code: stop.code }) : text;
}

/** The gate's own reason, in the player's terms — the panel prints the switch-off/stale/running
 *  sentence once, panel-wide; the row prints its own copy of the reason that disabled it. */
function gateReasonText(gate: Extract<StepGate, { enabled: false }>, otherStepTitle: string | null, t: Copy): string | undefined {
  switch (gate.reason) {
    case 'switchOff':
      return sub(t.applyPanelSwitchOff, { switch: t.settingsForgeWritesLabel });
    case 'stale':
      return t.applyPanelStale;
    case 'otherRunning':
      return otherStepTitle === null ? undefined : sub(t.applyPanelOtherRunning, { step: otherStepTitle });
    default:
      return undefined;
  }
}

function rowSkipReasonKey(
  reason: 'itemMissing' | 'heroMissing' | 'itemMoved' | 'allocationChanged' | 'notEnoughGold' | 'forgeAtTarget',
): keyof Copy {
  switch (reason) {
    case 'itemMissing':
      return 'applySkipItemMissing';
    case 'heroMissing':
      return 'applySkipHeroMissing';
    case 'itemMoved':
      return 'applySkipItemMoved';
    case 'allocationChanged':
      return 'applySkipAllocationChanged';
    case 'notEnoughGold':
      return 'applySkipNotEnoughGold';
    case 'forgeAtTarget':
      return 'applySkipForgeAtTarget';
  }
}

/** Builds the press action, omitting `reason` entirely rather than setting it to `undefined` —
 *  `exactOptionalPropertyTypes` treats the two differently, and only the omitted form satisfies
 *  the shell's optional-property contract. */
function pressAction(label: string, onPress: () => void, disabled: boolean, reason: string | undefined): ApplyStepRowAction {
  return reason === undefined ? { label, onPress, disabled } : { label, onPress, disabled, reason };
}

function willSkipNote(step: Extract<StepFacts, { kind: 'units' }>, t: Copy): ReactNode | null {
  if (step.skips.length === 0) return null;
  const grouped = groupSkips(step.skips);
  const reasons = grouped.groups
    .map((group) => sub(t.applySkipCounted, { n: group.count, reason: t[rowSkipReasonKey(group.reason)] }))
    .join(', ');
  return sub(t.applyStepWillSkip, { count: grouped.count, total: step.units.length, reasons });
}

/** One line per skip a finished run recorded, named against the row's own units by index so the
 *  reader sees the piece or hero, not a bare position — the row's "Show" reveal (AC3.8). */
function skipRecordNote(skip: SkipRecord, units: readonly ApplyUnitLabel[], t: Copy): ReactNode {
  const subject = units[skip.index]?.subject ?? String(skip.index);
  const reasonText = t[APPLY_SKIP_REASON_COPY_KEY[skip.reason]];
  return `${subject} — ${skip.code === undefined ? reasonText : sub(reasonText, { code: skip.code })}`;
}

export type WalletShortHero = { readonly heroId: string; readonly name: string; readonly needed: number; readonly onHand: number };

type RowShared = {
  readonly t: Copy;
  readonly step: ApplyStepId;
  readonly facts: StepFacts;
  readonly gate: StepGate;
  readonly record: StepRecord;
  readonly otherStepTitle: string | null;
  readonly onPress: () => void;
  readonly onShow: () => void;
  readonly showSkips: boolean;
};

/** Facts + notes + action for one row, shared by the Equip and Reset compositions below — the
 *  record (a run that already happened) always wins over the live gate, except that another step
 *  running still blocks a fresh "Run again" press. */
function buildRowAction(
  shared: RowShared,
  readyLabel: string,
  extraReadyNotes: readonly ReactNode[],
): { action: ApplyStepRowAction; notes: ReactNode[] } {
  const { t, facts, gate, record, onPress } = shared;

  if (record.status === 'done') {
    const notes: ReactNode[] = [sub(t.applyStepDone, { made: record.made, total: record.total, skipped: record.skipped })];
    if (shared.showSkips) {
      const units = facts.kind === 'units' ? facts.units : [];
      notes.push(...record.skips.map((skip) => skipRecordNote(skip, units, t)));
    }
    return { action: { label: t.applyStepShowSkips, onPress: shared.onShow, disabled: false }, notes };
  }
  if (record.status === 'stopped') {
    const blockingGate = !gate.enabled && gate.reason === 'otherRunning' ? gate : null;
    return {
      action: pressAction(
        t.applyStepRunAgain,
        onPress,
        blockingGate !== null,
        blockingGate === null ? undefined : gateReasonText(blockingGate, shared.otherStepTitle, t),
      ),
      notes: [sub(t.applyStepStopped, { reason: stopReasonText(record.reason, t) })],
    };
  }
  if (record.status === 'running' || (!gate.enabled && gate.reason === 'running')) {
    return { action: { nothing: t.applyStepRunning }, notes: [] };
  }
  if (!gate.enabled) {
    switch (gate.reason) {
      case 'nothing':
        return { action: { nothing: t.applyStepNothing }, notes: [] };
      case 'allDone':
        return {
          action: {
            nothing:
              facts.kind === 'units'
                ? sub(t.applyStepDone, { made: facts.done.length, total: facts.units.length, skipped: 0 })
                : t.applyStepNothing,
          },
          notes: [],
        };
      case 'nothingLeft':
        return { action: { nothing: t.applyStepNothingLeft }, notes: [] };
      case 'loading':
        return { action: { nothing: t.shellLoadingLabel }, notes: [] };
      default:
        return {
          action: pressAction(readyLabel, onPress, true, gateReasonText(gate, shared.otherStepTitle, t)),
          notes: [],
        };
    }
  }

  const notes: ReactNode[] = [];
  if (gate.notes.includes('pausesQueue')) notes.push(t.applyStepPausesQueue);
  if (facts.kind === 'units') {
    const skip = willSkipNote(facts, t);
    if (skip !== null) notes.push(skip);
  }
  notes.push(...extraReadyNotes);
  return { action: { label: readyLabel, onPress, disabled: false }, notes };
}

type RowPublicProps = Omit<RowShared, 'step' | 'onShow' | 'showSkips'>;

export function ApplyEquipRow({ t, facts, gate, record, otherStepTitle, onPress }: RowPublicProps) {
  const [showSkips, setShowSkips] = useState(false);
  const testId = 'apply-step-equip';
  const factsLine =
    facts.kind === 'nothing' ? t.applyStepNothing : sub(t.applyStepEquipFacts, { calls: facts.calls, time: formatClock(facts.aboutMs) });
  const { action, notes } = buildRowAction(
    { t, step: 'equip', facts, gate, record, otherStepTitle, onPress, onShow: () => { setShowSkips((v) => !v); }, showSkips },
    t.applyStepEquipTitle,
    [],
  );
  return <ApplyStepRow index={1} title={t.applyStepEquipTitle} facts={factsLine} notes={notes} action={action} testId={testId} />;
}

export function ApplyPointsRow({
  t,
  facts,
  gate,
  record,
  otherStepTitle,
  onPress,
  walletShort,
}: RowPublicProps & { readonly walletShort: readonly WalletShortHero[] }) {
  const [showSkips, setShowSkips] = useState(false);
  const { locale } = useLocale();
  const testId = 'apply-step-points';
  const factsLine =
    facts.kind === 'nothing'
      ? t.applyStepNothing
      : subNodes(t.applyStepPointsFacts, {
          heroes: facts.heroes,
          respecs: facts.respecs,
          calls: facts.calls,
          time: formatClock(facts.aboutMs),
          gold: <ForgeGold>{formatCount(facts.gold, locale)}</ForgeGold>,
        });
  const walletNotes = walletShort.map((hero) =>
    sub(t.applyStepWalletShort, { hero: hero.name, needed: formatCount(hero.needed, locale), onhand: formatCount(hero.onHand, locale) }),
  );
  const { action, notes } = buildRowAction(
    { t, step: 'points', facts, gate, record, otherStepTitle, onPress, onShow: () => { setShowSkips((v) => !v); }, showSkips },
    t.applyStepPointsTitle,
    walletNotes,
  );
  return <ApplyStepRow index={3} title={t.applyStepPointsTitle} facts={factsLine} notes={notes} action={action} testId={testId} />;
}
