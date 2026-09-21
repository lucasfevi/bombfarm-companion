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
import { Button, cn, Dialog, dialogDescClass } from '@bombfarm/ui';
import { sub, useCopy, type Copy } from '../../lib/copy';
import { APPLY_SKIP_REASON_COPY_KEY, APPLY_STOP_REASON_COPY_KEY, formatClock, unitCardText } from '../../lib/optimizer/apply-labels';
import type { ApplyModalState } from '../../lib/optimizer/apply-progress-reducer';
import { runCounts } from '../../lib/optimizer/apply-run-reducer';
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
}: {
  modal: ApplyModalState;
  queuePaused: boolean;
  onStop: () => void;
  onClose: () => void;
  onContinue: () => void;
  hasNext: boolean;
  nowMs: number;
}) {
  const t = useCopy();
  const run = modal.run;
  const counts = run === null ? null : runCounts(run);
  const cooldown = run?.cooldown ?? null;

  return (
    <>
      {modal.phase === 'waitingQueue' ? <p className={dialogDescClass}>{t.applyModalWaitingForge}</p> : null}

          {modal.phase === 'running' && run !== null && counts !== null ? (
            <div className="flex flex-col gap-3">
              <p className="m-0 text-[13px] tabular-nums text-muted" role="status" aria-live="polite">
                {sub(t.applyModalProgress, {
                  n: Math.min(counts.done + counts.skipped + 1, counts.total),
                  total: counts.total,
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
                className="h-1.5 w-full overflow-hidden rounded-sm border border-line bg-bg"
              >
                <span
                  className={cn(
                    'block',
                    'h-full',
                    cooldown !== null ? 'w-full' : 'bg-accent/70',
                    cooldown !== null && 'animate-pulse',
                    cooldown !== null && 'bg-warn/70',
                  )}
                  style={{
                    width:
                      cooldown !== null
                        ? '100%'
                        : `${String(Math.round(((counts.done + counts.skipped) / Math.max(counts.total, 1)) * 100))}%`,
                  }}
                />
              </div>

              {cooldown !== null ? (
                <p data-testid="apply-modal-card" className="m-0 text-[13px] text-warn" role="status" aria-live="polite">
                  {sub(t.applyModalCooldown, { n: cooldown.index + 1, countdown: formatClock(Math.max(0, cooldown.resumeAtMs - nowMs)) })}
                </p>
              ) : (() => {
                  const currentUnit = counts.current === null ? undefined : run.units[counts.current];
                  return currentUnit === undefined ? null : (
                    <p data-testid="apply-modal-card" className="m-0 text-[13px] text-ink" role="status" aria-live="polite">
                      {unitCardText(currentUnit, t)}
                    </p>
                  );
                })()}

              <ul data-testid="apply-modal-ledger" aria-label={t.applyModalLedgerAria} className="m-0 max-h-48 list-none overflow-y-auto p-0">
                {run.units.map((unit, index) => (
                  <ApplyModalLedgerLine key={unit.index} unit={unit} status={run.status[index] ?? 'next'} />
                ))}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line pt-2 text-[12px] text-muted">
                <span>{sub(t.applyModalFooter, { done: counts.done, skipped: counts.skipped, left: counts.left })}</span>
                <span>
                  <ForgeGold>{sub(t.applyModalGoldSoFar, { gold: String(run.goldSpent) })}</ForgeGold>
                </span>
                {queuePaused ? <span>{t.applyModalQueuePaused}</span> : null}
              </div>

              <div className="flex justify-end border-t border-line pt-3">
                <Button type="button" variant="ghost" data-testid="apply-modal-stop" disabled={modal.stopRequested} onClick={onStop}>
                  {modal.stopRequested ? t.applyModalStopping : t.applyModalStop}
                </Button>
              </div>
            </div>
          ) : null}

          {modal.phase === 'done' && run !== null && run.result !== null ? (
            <div data-testid="apply-modal-done" className="flex flex-col gap-3">
              <h3 className="m-0 text-sm font-semibold text-ink">{t.applyModalDoneTitle}</h3>
              <p className="m-0 text-[13px] text-ink">
                {sub(t.applyStepDone, { made: run.result.made, total: run.result.total, skipped: run.result.skipped.length })}
              </p>
              {run.result.stop !== 'finished' ? (
                <p data-testid="apply-modal-stop-reason" className="m-0 text-[13px] text-warn">
                  {runStopText(run.result.stop, run.result.stopCode, t)}
                </p>
              ) : null}
              {run.result.skipped.length > 0 ? (
                <div>
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
              <div className="flex justify-end gap-2 border-t border-line pt-3">
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
}: {
  modal: ApplyModalState | null;
  queuePaused: boolean;
  onStop: () => void;
  onClose: () => void;
  onContinue: () => void;
  hasNext: boolean;
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
        <Dialog.Popup data-testid="apply-modal" className="!max-h-[85vh] !w-[min(92vw,480px)] !p-4">
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
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
