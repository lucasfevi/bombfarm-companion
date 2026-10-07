import { memo } from 'react';
import { FIELD_SLOTS_MAX } from '@bombfarm/domain/casa-slots';
import type { LiveDamage, LiveDamageHeroRow, LiveDamageUnattributed } from '@bombfarm/contracts';
import { HeroIdentity } from '@bombfarm/game-art';
import { DataTable, formatCompactNumber, InfoTip, Panel, PanelHeader, type Lang } from '@bombfarm/ui';
import { sub, useCopy, useLocale, type Copy } from '../../lib/copy';
import type { LiveHeroFact } from '../../lib/live/live-model';
import { coverageMinutesLabel } from './format-live-duration';

const EM_DASH = '—';
const ROW_PX = 40;
const HEAD_PX = 32;

function numberText(value: number | null, lang: Lang): string {
  return value === null ? EM_DASH : formatCompactNumber(value, lang, 1);
}

/** One fixed column template, drawn twice: the scrolling table and the Unattributed row under
 *  it are separate tables, and a fixed layout with these widths is what keeps their columns on
 *  the same lines. */
function Columns() {
  return (
    <colgroup>
      <col className="w-60" />
      <col className="w-24" />
      <col className="w-20" />
      <col className="w-24" />
    </colgroup>
  );
}

const CELL_CLASS = 'h-10 py-1';
const GUTTER_CLASS = '[scrollbar-gutter:stable]';
const GOLD_CELL_CLASS = 'h-10 py-1 text-gold';
const MUTED_CELL_CLASS = 'h-10 py-1 text-muted';

/** Names what the figures mean once, behind the title. Nothing here depends on a figure, so it is
 *  memoised: the panel around it re-renders as the damage moves, and a Base UI tooltip rebuilt
 *  that often to draw the same glyph is work with no reading in it. */
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

const DamageHeroRowView = memo(function DamageHeroRowView({
  row,
  fact,
  lang,
}: {
  row: LiveDamageHeroRow;
  fact: LiveHeroFact | undefined;
  lang: Lang;
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
        {numberText(row.props, lang)}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric className={GOLD_CELL_CLASS}>
        {numberText(row.gold, lang)}
      </DataTable.Cell>
    </DataTable.Row>
  );
});

/**
 * What no hero could be credited with, on the same columns as the table above it but outside its
 * scroller, so it stays in view however many heroes the table holds. The row is always mounted
 * and always the same height: until there is damage to account for it draws nothing, and a row
 * that appeared with the first hit would shift everything under the panel.
 */
function UnattributedRow({ amounts, t, lang }: { amounts: LiveDamageUnattributed | null; t: Copy; lang: Lang }) {
  return (
    <DataTable.Root className="overflow-y-auto border-t border-line [scrollbar-gutter:stable]">
      <DataTable.Table className="w-[32rem] table-fixed [&_td]:py-1" aria-label={t.liveDamageUnattributedLabel}>
        <Columns />
        <DataTable.Body>
          <DataTable.Row data-testid="live-damage-unattributed">
            <DataTable.Cell className="h-10 py-1 font-bold text-muted">
              {amounts === null ? null : t.liveDamageUnattributedLabel}
            </DataTable.Cell>
            <DataTable.Cell align="right" numeric className={MUTED_CELL_CLASS}>
              {amounts === null ? null : numberText(amounts.dps, lang)}
            </DataTable.Cell>
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
}: {
  damage: LiveDamage | null;
  heroFacts: ReadonlyMap<string, LiveHeroFact>;
  fieldSize: number | undefined;
}) {
  const t = useCopy();
  const { lang } = useLocale();
  const slots = fieldSize ?? FIELD_SLOTS_MAX;
  const recentWindowText = sub(t.liveEarningsRecentWindowLabel, {
    minutes: coverageMinutesLabel(damage?.coverageSeconds ?? 0),
  });

  return (
    <Panel data-testid="live-damage" className="w-fit max-w-full self-start">
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
            <DataTable.Table className="w-[32rem] table-fixed [&_td]:py-1" aria-label={t.liveDamageTableAria}>
              <Columns />
              <Head t={t} />
              <DataTable.Body>
                {(damage?.heroes ?? []).map((row) => (
                  <DamageHeroRowView key={row.heroId} row={row} fact={heroFacts.get(row.heroId)} lang={lang} />
                ))}
              </DataTable.Body>
            </DataTable.Table>
          </DataTable.Root>
          <UnattributedRow amounts={damage?.unattributed ?? null} t={t} lang={lang} />
        </div>
      </div>
    </Panel>
  );
}
