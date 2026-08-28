/**
 * Next-point ranking (design.md §7.2). `ranking` is rendered in the engine's own
 * order — never filtered (design risk row: filtering would be a second mapping).
 */
import { DataTable, Panel, PanelHeader, Tooltip } from '@bombfarm/ui';
import { STAT_NAME_COPY_KEY, useCopy, useLocale } from '../../lib/copy';
import { formatDps, formatGainPct } from '../../lib/format';
import { adviceForHero } from '../../lib/planning/hero-advice';
import type { PlanningModel } from '../../lib/planning/types';
import { WithheldNotice } from './withheld-notice';

export function NextPointPanel({ model, heroId }: { model: PlanningModel; heroId: string | null }) {
  const t = useCopy();
  const { locale } = useLocale();
  if (!heroId) return null;
  const entry = model.heroes.find((candidate) => candidate.hero.id === heroId);
  if (!entry) return null;

  const advice = adviceForHero(model, heroId);

  if (advice.withheld) {
    return <WithheldNotice quantity="nextPointRanking" sections={advice.sections} />;
  }

  return (
    <Panel>
      <PanelHeader title={t.adviceNextPointTitle} />
      <Tooltip.Provider delay={180} closeDelay={80}>
        <DataTable.Root scrollable maxRows={7} rowHeight="2rem">
          <DataTable.Table data-testid="next-point-ranking">
            <DataTable.Head>
              <DataTable.Row>
                <DataTable.Header>{t.adviceNextPointStatColumn}</DataTable.Header>
                <DataTable.Header align="right">{t.adviceNextPointGainColumn}</DataTable.Header>
              </DataTable.Row>
            </DataTable.Head>
            <DataTable.Body>
              {advice.ranking.map((entry, index) => {
                const isTop = index === 0;
                return (
                  <DataTable.Row key={entry.stat}>
                    <DataTable.RowHeader data-testid={isTop ? 'next-point-top-stat' : undefined}>
                      {t[STAT_NAME_COPY_KEY[entry.stat]]}
                    </DataTable.RowHeader>
                    <DataTable.Cell align="right" numeric data-testid={isTop ? 'next-point-gain' : undefined}>
                      <Tooltip.Root>
                        <Tooltip.Trigger type="button">{formatGainPct(entry.gainPct, locale)}</Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Positioner sideOffset={6}>
                            <Tooltip.Popup>
                              <p className="m-0">{formatDps(advice.dps, locale)}</p>
                            </Tooltip.Popup>
                          </Tooltip.Positioner>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    </DataTable.Cell>
                  </DataTable.Row>
                );
              })}
            </DataTable.Body>
          </DataTable.Table>
        </DataTable.Root>
      </Tooltip.Provider>
    </Panel>
  );
}
