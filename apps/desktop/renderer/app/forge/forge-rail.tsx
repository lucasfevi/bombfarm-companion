'use client';

/**
 * The full-width band between the toolbar and the split, and only ever a live or just-finished
 * run: the ledger at the foot of the screen is what a player reads between runs, so with nothing
 * rolling this collapses to no height rather than leaving an empty band. A run expands it in
 * place through one height transition at the panel duration, instant under reduced motion.
 * `Done` shrinks it first; the view settles it once the shrink has run.
 *
 * The screen is sized by its content, so on a short window this band can open below the fold: the
 * reader confirms the spend and nothing appears to happen. A run starting brings it into view —
 * and only a run starting, and only when some part of it is out of view.
 */
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Button, cn, DataTable, motionTokens, Panel } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import { rungTally, type ForgeRunActive, type ForgeRunState } from '../../lib/forge/forge-run-reducer';
import { bringBandIntoView } from '../../lib/forge/run-into-view';
import { useContentHeight } from '../../lib/forge/use-content-height';
import { ForgeChart } from './forge-chart';
import { BLANK, forgeLevel, forgeRungLabel, type ForgeLabels } from './forge-labels';
import { ForgeResult } from './forge-result';

export type ForgeRailState = 'collapsed' | 'running' | 'finished';

export function forgeRailState(run: ForgeRunState): ForgeRailState {
  if (run.status === 'running') return 'running';
  if (run.status === 'done') return 'finished';
  return 'collapsed';
}

/** Staggered so the three dots read as one travelling wave rather than three lamps blinking
 *  together, and shortened from the utility's own two seconds so a wave finishes inside the
 *  shortest gap this word is ever shown for. */
const PACING_DOTS_MS = [0, 200, 400];
const PACING_DOT_CYCLE_MS = 1_200;

/** Always drawn, so the roll count and the spend beside it never move as it comes and goes. */
function Pacing({ pausing }: { pausing: boolean }) {
  const t = useCopy();
  return (
    <span
      data-testid="forge-rail-pausing"
      data-pausing={pausing ? 'true' : undefined}
      className={cn('text-muted', !pausing && 'invisible')}
    >
      {t.forgeRailPausing}
      <span aria-hidden="true">
        {PACING_DOTS_MS.map((delay) => (
          <span
            key={delay}
            className="motion-safe:animate-pulse"
            style={{ animationDelay: `${String(delay)}ms`, animationDuration: `${String(PACING_DOT_CYCLE_MS)}ms` }}
          >
            .
          </span>
        ))}
      </span>
    </span>
  );
}

function Running({ run, gold, onCancel }: { run: ForgeRunActive; gold: (amount: number) => string; onCancel: () => void }) {
  const t = useCopy();
  const rows = useMemo(() => rungTally(run.steps), [run.steps]);

  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
        <span data-testid="forge-rail-level" className="font-mono text-base font-semibold tabular-nums text-accent">
          {forgeLevel(run.upgrade)}
        </span>
        <span data-testid="forge-rail-target" className="font-mono tabular-nums text-muted">
          {`→ ${forgeLevel(run.target)}`}
        </span>
        <span data-testid="forge-rail-rolls" className="tabular-nums text-ink">
          {sub(t.forgeRailRolls, { rolls: run.tally.rolls })}
        </span>
        <span data-testid="forge-rail-spent" className="tabular-nums text-ink">
          {sub(t.forgeRailSpent, { spent: gold(run.tally.spent) })}
        </span>
        <span data-testid="forge-rail-wallet" className="tabular-nums text-muted">
          {run.wallet === null ? BLANK : sub(t.forgeRailWallet, { wallet: gold(run.wallet) })}
        </span>
        <Pacing pausing={run.pausingMs !== null} />
        <Button
          type="button"
          variant="default"
          className="ml-auto"
          data-testid="forge-rail-cancel"
          data-pending={run.cancelRequested ? 'true' : undefined}
          disabled={run.cancelRequested}
          onClick={onCancel}
        >
          {run.cancelRequested ? t.forgeButtonCancelPending : t.forgeButtonCancel}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col">
          <ForgeChart start={run.from} target={run.target} steps={run.steps} />
        </div>

        <DataTable.Root>
          <DataTable.Table data-testid="forge-tally">
            <DataTable.Caption>{t.forgeRailTallyCaption}</DataTable.Caption>
            <DataTable.Head>
              <DataTable.Row>
                <DataTable.Header scope="col">{t.forgeRailTallyRung}</DataTable.Header>
                <DataTable.Header scope="col" align="right">
                  {t.forgeRailTallyRolls}
                </DataTable.Header>
                <DataTable.Header scope="col" align="right">
                  {t.forgeRailTallyFails}
                </DataTable.Header>
                <DataTable.Header scope="col" align="right">
                  {t.forgeRailTallyGold}
                </DataTable.Header>
              </DataTable.Row>
            </DataTable.Head>
            <DataTable.Body>
              {rows.map((row) => (
                <DataTable.Row key={row.from} data-testid="forge-tally-row">
                  <DataTable.RowHeader>
                    <span data-testid="forge-tally-rung" className="font-mono tabular-nums">
                      {forgeRungLabel(row)}
                    </span>
                  </DataTable.RowHeader>
                  <DataTable.Cell align="right" numeric data-testid="forge-tally-rolls">
                    {row.rolls}
                  </DataTable.Cell>
                  <DataTable.Cell align="right" numeric className={row.fails > 0 ? 'text-down' : undefined} data-testid="forge-tally-fails">
                    {row.fails}
                  </DataTable.Cell>
                  <DataTable.Cell align="right" numeric data-testid="forge-tally-gold">
                    {gold(row.gold)}
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable.Body>
          </DataTable.Table>
        </DataTable.Root>
      </div>
    </Panel>
  );
}

export function ForgeRail({
  run,
  gold,
  labels,
  onCancel,
  onDone,
}: {
  run: ForgeRunState;
  gold: (amount: number) => string;
  labels: ForgeLabels;
  onCancel: () => void;
  onDone: () => void;
}) {
  const state = forgeRailState(run);
  const { ref, height } = useContentHeight();
  const band = useRef<HTMLDivElement | null>(null);
  const brought = useRef(false);

  useEffect(() => {
    if (run.status !== 'running') {
      brought.current = false;
      return;
    }
    if (brought.current || height === undefined || height === 0) return;
    brought.current = true;
    bringBandIntoView(band.current, height);
  }, [run.status, height]);

  let content: ReactNode = null;
  if (run.status === 'running') content = <Running run={run.run} gold={gold} onCancel={onCancel} />;
  else if (run.status === 'done') {
    content = (
      <Panel>
        <ForgeResult result={run.result} plan={run.run.plan} labels={labels} onDone={onDone} />
      </Panel>
    );
  }

  return (
    <div
      ref={band}
      data-testid="forge-rail"
      data-state={state}
      className="relative shrink-0 overflow-hidden motion-safe:transition-[height] motion-safe:ease-out motion-reduce:transition-none"
      style={{ height: content === null ? 0 : height, transitionDuration: `${String(motionTokens.panelMs)}ms` }}
    >
      <div ref={ref}>{content}</div>
    </div>
  );
}
