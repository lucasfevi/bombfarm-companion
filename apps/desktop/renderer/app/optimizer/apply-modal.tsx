'use client';

/**
 * The blocking window a confirm opens — every call goes out one at a time, in view, and Stop
 * always works between calls. Composed the way `TeamPlanOptimizingModal` composes its own
 * controlled, non-dismissable dialog (the installed Base UI has no `dismissible` prop) —
 * controlled `open`, every close request ignored before `done`, `disablePointerDismissal`, and no
 * close control drawn until the Done view renders its own Close button.
 */
import { useEffect, useState } from 'react';
import type { ApplyStopReason } from '@bombfarm/contracts';
import { estimateApplyDurationMs } from '@bombfarm/domain/team-plan';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { Button, cn, Dialog, Icon, dialogDescClass } from '@bombfarm/ui';
import { sub, useCopy, useLocale, type Copy } from '../../lib/copy';
import { formatCount } from '../../lib/format';
import { APPLY_SKIP_REASON_COPY_KEY, APPLY_STOP_REASON_COPY_KEY, formatClock, type ApplyUnitLabel } from '../../lib/optimizer/apply-labels';
import type { ApplyModalState } from '../../lib/optimizer/apply-progress-reducer';
import { runCounts, type ApplyRunView } from '../../lib/optimizer/apply-run-reducer';
import { ForgeGold } from '../forge/forge-gold';
import { ApplyModalLedgerLine } from './apply-modal-ledger';

function runStopText(stop: Exclude<ApplyStopReason, 'finished'>, code: string | null, t: Copy): string {
  const text = t[APPLY_STOP_REASON_COPY_KEY[stop]];
  return stop === 'refused' && code !== null ? sub(text, { code }) : text;
}

/** A plain function rather than JSX so it is directly testable — `Dialog.Title` reads Base UI's
 *  own root context and cannot be rendered outside a real `Dialog.Root` (it throws), so the text
 *  it carries is proven here, once, instead of through a render that would crash. */
export function applyModalTitle(step: ApplyModalState['step'], t: Copy): string {
  return step === 'equip' ? t.applyModalEquipTitle : t.applyModalPointsTitle;
}

export function doneTitle(step: ApplyModalState['step'], t: Copy): string {
  return step === 'equip' ? t.applyModalDoneEquipTitle : t.applyModalDonePointsTitle;
}

export function progressPercent(counts: { readonly done: number; readonly skipped: number; readonly total: number }): number {
  return Math.round(((counts.done + counts.skipped) / Math.max(counts.total, 1)) * 100);
}

/** What the app is doing this instant, in the player's words — the call out for the current
 *  unit, or the gap between two calls. */
export function doingNowText(run: ApplyRunView, current: number | null, t: Copy): string {
  const unit = current === null ? undefined : run.units[current];
  if (unit === undefined) return t.applyModalNowBetween;
  switch (unit.call) {
    case 'equip':
      return sub(t.applyModalNowEquip, { item: unit.subject, hero: unit.to ?? '' });
    case 'unequip':
      return sub(t.applyModalNowUnequip, { item: unit.subject });
    case 'respec':
    case 'commit':
      return run.currentCall === 'commit' || unit.call === 'commit'
        ? sub(t.applyModalNowCommit, { hero: unit.subject })
        : sub(t.applyModalNowRespec, { hero: unit.subject });
    default:
      return t.applyModalNowBetween;
  }
}

/**
 * Everything the dialog draws, pulled out of `Dialog.Portal` so it can be rendered and asserted
 * on its own — `renderToStaticMarkup` skips everything under a Base UI portal in this project (no
 * jsdom), the same reason `consent-modal.tsx` splits `ConsentClauseList` out of its dialog shell.
 * `ApplyModal` below is the only caller in the running app; a test renders this directly.
 */
export function ApplyModalBody({
  modal,
  queuePaused,
  onStop,
  onClose,
  onContinue,
  hasNext,
  nowMs,
  heroById,
}: {
  modal: ApplyModalState;
  queuePaused: boolean;
  onStop: () => void;
  onClose: () => void;
  onContinue: () => void;
  hasNext: boolean;
  nowMs: number;
  heroById: ReadonlyMap<string, HeroRecord>;
}) {
  const t = useCopy();
  const { locale } = useLocale();
  const run = modal.run;
  const counts = run === null ? null : runCounts(run);
  const cooldown = run?.cooldown ?? null;
  const heroOf = (unit: ApplyUnitLabel | undefined) => (unit?.heroId ? heroById.get(unit.heroId) : undefined);

  return (
    <>
      {modal.phase === 'waitingQueue' ? <p className={dialogDescClass}>{t.applyModalWaitingForge}</p> : null}

      {modal.phase === 'running' && run !== null && counts !== null ? (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-[13px] tabular-nums text-muted" role="status" aria-live="polite">
            {sub(t.applyModalProgress, {
              elapsed: formatClock(nowMs - run.startedAtMs),
              left: formatClock(estimateApplyDurationMs(counts.left)),
            })}
          </p>
          <div
            data-testid="apply-modal-progress"
            role="progressbar"
            aria-label={t.applyModalProgressAria}
            aria-valuenow={counts.done + counts.skipped}
            aria-valuemin={0}
            aria-valuemax={counts.total}
            data-cooldown={cooldown !== null ? 'true' : undefined}
            className="relative h-5 w-full overflow-hidden rounded-sm border border-line bg-bg"
          >
            <span
              className={cn('block', 'h-full', cooldown !== null ? 'bg-warn/60' : 'bg-accent/70', cooldown !== null ? 'animate-pulse' : null)}
              style={{ width: `${String(progressPercent(counts))}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] font-semibold text-ink tabular-nums">
              {`${String(progressPercent(counts))}%`}
            </span>
          </div>
          <p data-testid="apply-modal-card" className={cn('m-0', 'text-[12px]', cooldown !== null ? 'text-warn' : 'text-muted')} role="status" aria-live="polite">
            {cooldown !== null
              ? sub(t.applyModalCooldown, { countdown: formatClock(Math.max(0, cooldown.resumeAtMs - nowMs)) })
              : doingNowText(run, counts.current, t)}
          </p>

          <ul data-testid="apply-modal-ledger" aria-label={t.applyModalLedgerAria} className="m-0 max-h-56 list-none overflow-y-auto p-0">
            {run.units.map((unit, index) => (
              <ApplyModalLedgerLine key={unit.index} unit={unit} status={run.status[index] ?? 'next'} hero={heroOf(unit)} />
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line py-2.5 text-[12px] text-muted">
            <span>{sub(t.applyModalFooter, { done: counts.done, skipped: counts.skipped, left: counts.left })}</span>
            <span className="flex items-center gap-3">
              {queuePaused ? <span>{t.applyModalQueuePaused}</span> : null}
              <ForgeGold>{sub(t.applyModalGoldSoFar, { gold: formatCount(run.goldSpent, locale) })}</ForgeGold>
            </span>
          </div>

          <div className="-mx-4 flex justify-end border-t border-line px-4 pt-3">
            <Button type="button" variant="ghost" data-testid="apply-modal-stop" disabled={modal.stopRequested} onClick={onStop}>
              {modal.stopRequested ? t.applyModalStopping : t.applyModalStop}
            </Button>
          </div>
        </div>
      ) : null}

      {modal.phase === 'done' && run !== null && run.result !== null ? (
        <div data-testid="apply-modal-done" className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <span className={cn('flex', 'size-6', 'shrink-0', 'items-center', 'justify-center', 'rounded-full', run.result.stop === 'finished' ? 'bg-up' : 'bg-warn', 'text-accent-ink')}>
              <Icon name={run.result.stop === 'finished' ? 'check' : 'exclamation-triangle'} className="size-3.5" />
            </span>
            <h3 className="m-0 text-sm font-semibold text-ink">
              {run.result.stop === 'finished' ? doneTitle(modal.step, t) : t.applyModalStoppedTitle}
            </h3>
            <span className="ml-auto font-mono text-[12px] text-muted tabular-nums">{formatClock(run.result.durationMs)}</span>
          </div>
          <p className="m-0 text-[13px] text-ink">
            {sub(t.applyModalDoneSummary, { made: run.result.made, total: run.result.total, skipped: run.result.skipped.length })}
            {' · '}
            <ForgeGold>{sub(t.applyModalGoldSpent, { gold: formatCount(run.result.goldSpent, locale) })}</ForgeGold>
          </p>
          {run.result.stop !== 'finished' ? (
            <p data-testid="apply-modal-stop-reason" className="m-0 text-[13px] text-warn">
              {runStopText(run.result.stop, run.result.stopCode, t)}
            </p>
          ) : null}

          <ul data-testid="apply-modal-ledger" aria-label={t.applyModalLedgerAria} className="m-0 max-h-56 list-none overflow-y-auto border-t border-line p-0 pt-1">
            {run.units.map((unit, index) => (
              <ApplyModalLedgerLine key={unit.index} unit={unit} status={run.status[index] ?? 'next'} hero={heroOf(unit)} />
            ))}
          </ul>

          {run.result.skipped.length > 0 ? (
            <div className="border-t border-line pt-2">
              <h4 className="m-0 text-xs font-semibold text-ink">{t.applyModalSkippedTitle}</h4>
              <ul data-testid="apply-modal-skipped" className="m-0 list-none p-0">
                {run.result.skipped.map((skip) => (
                  <li key={skip.index} data-testid="apply-modal-skipped-line" className="text-[12px] text-muted">
                    {`${run.units[skip.index]?.subject ?? String(skip.index)} — ${t[APPLY_SKIP_REASON_COPY_KEY[skip.reason]]}`}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="m-0 text-[12px] text-muted">{hasNext ? t.applyModalDoneNext : t.applyModalDoneAll}</p>
          <div className="-mx-4 flex justify-end gap-2 border-t border-line px-4 pt-3">
            <Button type="button" variant="ghost" data-testid="apply-modal-close" onClick={onClose}>
              {t.applyModalClose}
            </Button>
            {hasNext ? (
              <Button type="button" variant="primary" data-testid="apply-modal-continue" onClick={onContinue}>
                {t.applyModalContinue}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ApplyModal({
  modal,
  queuePaused,
  onStop,
  onClose,
  onContinue,
  hasNext,
  heroById,
}: {
  modal: ApplyModalState | null;
  queuePaused: boolean;
  onStop: () => void;
  onClose: () => void;
  onContinue: () => void;
  hasNext: boolean;
  /** The plan's heroes by id, for the ledger's identity chips. */
  heroById: ReadonlyMap<string, HeroRecord>;
}) {
  const t = useCopy();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const running = modal !== null && modal.phase === 'running' && modal.run !== null;

  // The same 250ms tick `TeamPlanOptimizingModal` uses for its own elapsed clock — the run's own
  // `startedAtMs` and `resumeAtMs` are the source of truth, so this tick only re-reads them,
  // never accumulates drift.
  useEffect(() => {
    if (!running) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);
    return () => {
      window.clearInterval(id);
    };
  }, [running, modal?.run?.runId]);

  if (modal === null) return null;

  return (
    <Dialog.Root
      open
      modal
      disablePointerDismissal
      onOpenChange={(next: boolean) => {
        if (!next && modal.phase === 'done') onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup data-testid="apply-modal" className="!max-h-[85vh] !w-[min(92vw,560px)] !p-4">
          <Dialog.Head>
            <Dialog.Title>{applyModalTitle(modal.step, t)}</Dialog.Title>
          </Dialog.Head>
          <ApplyModalBody
            modal={modal}
            queuePaused={queuePaused}
            onStop={onStop}
            onClose={onClose}
            onContinue={onContinue}
            hasNext={hasNext}
            nowMs={nowMs}
            heroById={heroById}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
