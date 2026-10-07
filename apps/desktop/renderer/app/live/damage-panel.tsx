import { memo } from 'react';
import { FIELD_SLOTS_MAX } from '@bombfarm/domain/casa-slots';
import type { LiveDamage, LiveDamageHeroRow, LiveDamageUnattributed } from '@bombfarm/contracts';
import { HeroIdentity } from '@bombfarm/game-art';
import { cn, DataTable, formatCompactNumber, InfoTip, Panel, PanelHeader, Tooltip, type Lang } from '@bombfarm/ui';
import { sub, useCopy, useLocale, type Copy } from '../../lib/copy';
import type { LiveHeroFact } from '../../lib/live/live-model';
import { coverageMinutesLabel, formatLiveDurationSeconds } from './format-live-duration';

const EM_DASH = '—';
const ROW_PX = 40;
const HEAD_PX = 32;

function numberText(value: number | null, lang: Lang): string {
  return value === null ? EM_DASH : formatCompactNumber(value, lang, 1);
}

function uptimeText(uptime: number): string {
  return `${String(Math.round(uptime * 100))}%`;
}

/** The scrolling table and the Unattributed row are separate tables; these fixed widths keep their columns aligned. */
function Columns() {
  return (
    <colgroup>
      <col />
      <col className="w-20" />
      <col className="w-20" />
      <col className="w-16" />
      <col className="w-20" />
    </colgroup>
  );
}

const CELL_CLASS = 'h-10 py-1';
const GUTTER_CLASS = '[scrollbar-gutter:stable]';
const GOLD_CELL_CLASS = 'h-10 py-1 text-gold';
const MUTED_CELL_CLASS = 'h-10 py-1 text-muted';

/** Memoised: the panel re-renders as damage moves, and this tooltip depends on no figure. */
const DamageInfo = memo(function DamageInfo({ t }: { t: Copy }) {
  return <InfoTip label={t.liveDamageInfoLabel} tip={t.liveDamageInfoBody} />;
});

function TeamFigure({ testId, caption, value }: { testId: string; caption: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[10.5px] uppercase tracking-[0.06em] text-muted whitespace-nowrap">{caption}</span>
      <span data-testid={testId} className="text-[23px] font-bold leading-none text-ink tabular-nums whitespace-nowrap">
        {value}
      </span>
    </div>
  );
}

/** The trigger is a button so keyboard focus reaches the tooltip; its name carries the figure as
 *  well as the sentence, since a label would otherwise replace the percentage a screen reader reads. */
const UptimeFigure = memo(function UptimeFigure({ percent, tip, testId }: { percent: string; tip: string; testId: string }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        type="button"
        data-testid={testId}
        aria-label={`${percent}: ${tip}`}
        className="cursor-help border-0 bg-transparent p-0 font-[inherit] text-[inherit] underline decoration-dotted underline-offset-2 hover:text-ink focus-visible:rounded-sm focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {percent}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup>
            <p className="m-0">{tip}</p>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
});

const DamageHeroRowView = memo(function DamageHeroRowView({
  row,
  fact,
  lang,
  t,
  sessionSeconds,
}: {
  row: LiveDamageHeroRow;
  fact: LiveHeroFact | undefined;
  lang: Lang;
  t: Copy;
  sessionSeconds: number;
}) {
  const rank = fact?.name !== undefined ? fact.grade?.trim() : undefined;
  return (
    <DataTable.Row data-testid={`live-damage-row-${row.heroId}`}>
      <DataTable.Cell className={CELL_CLASS}>
        <HeroIdentity
          name={fact?.name ?? row.heroId}
          rank={rank}
          rarityIdx={fact?.rarity}
          stars={fact?.stars}
          level={fact?.level}
          skin={fact?.skin}
          lang={lang}
          size="xs"
          showRarity={false}
          nameTestId={`live-damage-row-${row.heroId}-name`}
        />
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric className={CELL_CLASS}>
        {numberText(row.dps, lang)}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric className={CELL_CLASS}>
        {row.uptime === null ? (
          EM_DASH
        ) : (
          <UptimeFigure
            testId={`live-damage-row-${row.heroId}-uptime`}
            percent={uptimeText(row.uptime)}
            tip={sub(t.liveDamageUptimeTip, {
              field: formatLiveDurationSeconds(row.fieldSeconds),
              session: formatLiveDurationSeconds(sessionSeconds),
            })}
          />
        )}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric className={CELL_CLASS}>
        {numberText(row.props, lang)}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric className={GOLD_CELL_CLASS}>
        {numberText(row.gold, lang)}
      </DataTable.Cell>
    </DataTable.Row>
  );
});

/** Always mounted at full height and empty until there is damage: a row that appeared with the first hit would shift the panels below. */
function UnattributedRow({ amounts, t, lang }: { amounts: LiveDamageUnattributed | null; t: Copy; lang: Lang }) {
  return (
    <DataTable.Root className="overflow-y-auto border-t border-line [scrollbar-gutter:stable]">
      <DataTable.Table className="w-full table-fixed [&_td]:py-1" aria-label={t.liveDamageUnattributedLabel}>
        <Columns />
        <DataTable.Body>
          <DataTable.Row data-testid="live-damage-unattributed">
            <DataTable.Cell className="h-10 py-1 font-bold text-muted">
              {amounts === null ? null : t.liveDamageUnattributedLabel}
            </DataTable.Cell>
            <DataTable.Cell align="right" numeric className={MUTED_CELL_CLASS}>
              {amounts === null ? null : numberText(amounts.dps, lang)}
            </DataTable.Cell>
            <DataTable.Cell align="right" numeric className={MUTED_CELL_CLASS} />
            <DataTable.Cell align="right" numeric className={MUTED_CELL_CLASS}>
              {amounts === null ? null : numberText(amounts.props, lang)}
            </DataTable.Cell>
            <DataTable.Cell align="right" numeric className={MUTED_CELL_CLASS}>
              {amounts === null ? null : numberText(amounts.gold, lang)}
            </DataTable.Cell>
          </DataTable.Row>
        </DataTable.Body>
      </DataTable.Table>
    </DataTable.Root>
  );
}

function Head({ t }: { t: Copy }) {
  return (
    <DataTable.Head>
      <DataTable.Row>
        <DataTable.Header className="h-8">{t.liveDamageHeroColumn}</DataTable.Header>
        <DataTable.Header align="right" className="h-8">
          {t.liveDamageDpsColumn}
        </DataTable.Header>
        <DataTable.Header align="right" className="h-8">
          {t.liveDamageUptimeColumn}
        </DataTable.Header>
        <DataTable.Header align="right" className="h-8">
          {t.liveDamagePropsColumn}
        </DataTable.Header>
        <DataTable.Header align="right" className="h-8">
          {t.liveDamageGoldColumn}
        </DataTable.Header>
      </DataTable.Row>
    </DataTable.Head>
  );
}

export function DamagePanel({
  damage,
  heroFacts,
  fieldSize,
  className,
}: {
  damage: LiveDamage | null;
  heroFacts: ReadonlyMap<string, LiveHeroFact>;
  fieldSize: number | undefined;
  className?: string;
}) {
  const t = useCopy();
  const { lang } = useLocale();
  const slots = fieldSize ?? FIELD_SLOTS_MAX;
  const recentWindowText = sub(t.liveEarningsRecentWindowLabel, {
    minutes: coverageMinutesLabel(damage?.coverageSeconds ?? 0),
  });

  return (
    <Tooltip.Provider delay={180} closeDelay={80}>
      <Panel data-testid="live-damage" className={cn('[contain:inline-size]', className)}>
        <PanelHeader title={t.liveDamageTitle} info={<DamageInfo t={t} />} />
        <div className="flex flex-col gap-3">
          <div data-testid="live-damage-team" className="flex gap-8">
            <TeamFigure
              testId="live-damage-team-dps-10"
              caption={`${t.liveDamageTeamDpsLabel} ${recentWindowText}`}
              value={numberText(damage?.teamDps10 ?? null, lang)}
            />
            <TeamFigure
              testId="live-damage-team-dps-session"
              caption={`${t.liveDamageTeamDpsLabel} ${t.liveDamageSessionWindowLabel}`}
              value={numberText(damage?.teamDpsSession ?? null, lang)}
            />
          </div>
          <div className="flex flex-col">
            <DataTable.Root
              scrollable
              minRows={slots}
              maxRows={slots}
              rowHeight={`calc(${String(ROW_PX)}px + ${String(HEAD_PX)}px / ${String(slots)})`}
              className={GUTTER_CLASS}
              data-testid="live-damage-scroller"
            >
              <DataTable.Table className="w-full table-fixed [&_td]:py-1" aria-label={t.liveDamageTableAria}>
                <Columns />
                <Head t={t} />
                <DataTable.Body>
                  {(damage?.heroes ?? []).map((row) => (
                    <DamageHeroRowView
                      key={row.heroId}
                      row={row}
                      fact={heroFacts.get(row.heroId)}
                      lang={lang}
                      t={t}
                      sessionSeconds={damage?.sessionSeconds ?? 0}
                    />
                  ))}
                </DataTable.Body>
              </DataTable.Table>
            </DataTable.Root>
            <UnattributedRow amounts={damage?.unattributed ?? null} t={t} lang={lang} />
          </div>
        </div>
      </Panel>
    </Tooltip.Provider>
  );
}
