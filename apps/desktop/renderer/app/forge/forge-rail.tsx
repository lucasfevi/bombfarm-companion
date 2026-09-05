'use client';

/**
 * The full-width band between the toolbar and the split, and only ever a live or just-finished
 * run: the ledger at the foot of the screen is what a player reads between runs, so with nothing
 * rolling this collapses to no height rather than leaving an empty band. A run expands it in
 * place through one height transition at the panel duration, instant under reduced motion.
 * `Done` shrinks it first; the view settles it once the shrink has run.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, cn, DataTable, motionTokens, Panel } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import { recentSteps, rungTally, type ForgeRunActive, type ForgeRunState } from '../../lib/forge/forge-run-reducer';
import { ForgeChart, forgeMarkClass, forgeMarkLabel } from './forge-chart';
import { BLANK, forgeLevel, forgeRungLabel, type ForgeLabels } from './forge-labels';
import { ForgeResult } from './forge-result';

export type ForgeRailState = 'collapsed' | 'running' | 'finished';

export function forgeRailState(run: ForgeRunState): ForgeRailState {
  if (run.status === 'running') return 'running';
  if (run.status === 'done') return 'finished';
  return 'collapsed';
}

/** The rendered height of the content, followed as it changes, so the wrapper can animate to it.
 *  Undefined until measured — the first paint is at the natural height, with no transition. */
function useContentHeight(): { ref: (node: HTMLDivElement | null) => void; height: number | undefined } {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (node === null || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      setHeight(node.getBoundingClientRect().height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [node]);
  return { ref: setNode, height };
}

function Running({ run, gold, onCancel }: { run: ForgeRunActive; gold: (amount: number) => string; onCancel: () => void }) {
  const t = useCopy();
  const rows = useMemo(() => rungTally(run.steps), [run.steps]);
  const recent = useMemo(() => recentSteps(run.steps), [run.steps]);

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
        <div className="flex min-w-0 flex-col gap-1">
          <ForgeChart start={run.from} target={run.target} steps={run.steps} />
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <span>{t.forgeRailRecent}</span>
            <ol data-testid="forge-recent" aria-label={t.forgeRailRecent} className="m-0 flex list-none gap-1 p-0">
              {recent.map((step) => (
                <li
                  key={step.attempt}
                  role="img"
                  aria-label={forgeMarkLabel(step, t)}
                  data-outcome={step.kind === 'safe' ? 'safe' : step.outcome}
                  className={cn('size-2', 'rounded-full', 'bg-current', forgeMarkClass(step))}
                />
              ))}
            </ol>
          </div>
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
      data-testid="forge-rail"
      data-state={state}
      className="relative shrink-0 overflow-hidden motion-safe:transition-[height] motion-safe:ease-out motion-reduce:transition-none"
      style={{ height: content === null ? 0 : height, transitionDuration: `${String(motionTokens.panelMs)}ms` }}
    >
      <div ref={ref}>{content}</div>
    </div>
  );
}
