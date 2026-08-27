/**
 * The roster (design.md §7.2, MPV-12/13/14/15). Every row sourced from the parsed `HeroRecord`;
 * no local table markup — `DataTable` only (`Root scrollable` — the modern, non-deprecated form
 * of `TableScroller`, which `@typescript-eslint/no-deprecated` forbids). Selection is a
 * `Button`, so the only interactive control here is a shipped primitive (MPV-14).
 */
import { Button, Chip, DataTable, cn } from '@bombfarm/ui';
import { rarityLabel } from '@bombfarm/domain/game-labels';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import { HeroAvatar, rarityTextClass } from '@bombfarm/game-art';
import { useCopy, useLocale } from '../../lib/copy';
import { formatCount } from '../../lib/format';
import type { RosterEntry } from '../../lib/planning/types';

export function RosterList({
  heroes,
  selectedHeroId,
  onSelect,
}: {
  heroes: readonly RosterEntry[];
  selectedHeroId: string | null;
  onSelect: (heroId: string) => void;
}) {
  const t = useCopy();
  const { locale, lang } = useLocale();

  return (
    <DataTable.Root scrollable maxRows={12} rowHeight="2.5rem">
      <DataTable.Table data-testid="roster-list">
        <DataTable.Head>
          <DataTable.Row>
            <DataTable.Header className="w-14" aria-label={t.planningRosterColumnAvatar}>
              <span className="sr-only">{t.planningRosterColumnAvatar}</span>
            </DataTable.Header>
            <DataTable.Header>{t.planningRosterColumnName}</DataTable.Header>
            <DataTable.Header align="right">{t.planningRosterColumnLevel}</DataTable.Header>
            <DataTable.Header align="right">{t.planningRosterColumnStars}</DataTable.Header>
            <DataTable.Header>{t.planningRosterColumnRarity}</DataTable.Header>
          </DataTable.Row>
        </DataTable.Head>
        <DataTable.Body>
          {heroes.map((entry) => {
            const selected = entry.hero.id === selectedHeroId;
            const rarIdx = RARITIES.indexOf(entry.hero.rarity);
            return (
              <DataTable.Row key={entry.hero.id} data-testid={`roster-row-${entry.hero.id}`} aria-selected={selected}>
                <DataTable.Cell className="w-14 px-1" nowrap={false}>
                  <HeroAvatar
                    skin={entry.hero.skin ?? 0}
                    rarityIdx={rarIdx}
                    size="sm"
                    name={entry.hero.name}
                  />
                </DataTable.Cell>
                <DataTable.RowHeader>
                  <Button
                    type="button"
                    variant="text"
                    aria-pressed={selected}
                    onClick={() => {
                      onSelect(entry.hero.id);
                    }}
                    className="w-full justify-start text-left text-[13px] leading-none font-bold normal-case text-ink"
                  >
                    {entry.hero.name}
                  </Button>
                </DataTable.RowHeader>
                <DataTable.Cell align="right" numeric>
                  {formatCount(entry.hero.level, locale)}
                </DataTable.Cell>
                <DataTable.Cell align="right" numeric>
                  {formatCount(entry.hero.stars, locale)}
                </DataTable.Cell>
                <DataTable.Cell>
                  <Chip variant="small" className={cn(rarityTextClass(rarIdx) ?? 'text-muted')}>
                    {rarityLabel(entry.hero.rarity, lang)}
                  </Chip>
                </DataTable.Cell>
              </DataTable.Row>
            );
          })}
        </DataTable.Body>
      </DataTable.Table>
    </DataTable.Root>
  );
}
