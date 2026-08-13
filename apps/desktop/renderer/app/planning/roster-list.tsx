/**
 * The roster (design.md §7.2, MPV-12/13/14/15). Every row sourced from the parsed `HeroRecord`;
 * no local table markup — `DataTable` only (`Root scrollable` — the modern, non-deprecated form
 * of `TableScroller`, which `@typescript-eslint/no-deprecated` forbids). Selection is a
 * `Button`, so the only interactive control here is a shipped primitive (MPV-14).
 */
import { Button, Chip, DataTable } from '@bombfarm/ui';
import { rarityLabel } from '@bombfarm/domain/game-labels';
import { useCopy } from '../../lib/copy';
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

  return (
    <DataTable.Root scrollable maxRows={12} rowHeight="2.5rem">
      <DataTable.Table data-testid="roster-list">
        <DataTable.Head>
          <DataTable.Row>
            <DataTable.Header>{t.planningRosterColumnName}</DataTable.Header>
            <DataTable.Header align="right">{t.planningRosterColumnLevel}</DataTable.Header>
            <DataTable.Header align="right">{t.planningRosterColumnStars}</DataTable.Header>
            <DataTable.Header>{t.planningRosterColumnRarity}</DataTable.Header>
          </DataTable.Row>
        </DataTable.Head>
        <DataTable.Body>
          {heroes.map((entry) => {
            const selected = entry.hero.id === selectedHeroId;
            return (
              <DataTable.Row key={entry.hero.id} data-testid={`roster-row-${entry.hero.id}`} aria-selected={selected}>
                <DataTable.RowHeader>
                  <Button
                    type="button"
                    variant="text"
                    aria-pressed={selected}
                    onClick={() => {
                      onSelect(entry.hero.id);
                    }}
                    className="w-full justify-start text-left"
                  >
                    {entry.hero.name}
                  </Button>
                </DataTable.RowHeader>
                <DataTable.Cell align="right" numeric>
                  {formatCount(entry.hero.level)}
                </DataTable.Cell>
                <DataTable.Cell align="right" numeric>
                  {formatCount(entry.hero.stars)}
                </DataTable.Cell>
                <DataTable.Cell>
                  <Chip variant="small">{rarityLabel(entry.hero.rarity, 'en')}</Chip>
                </DataTable.Cell>
              </DataTable.Row>
            );
          })}
        </DataTable.Body>
      </DataTable.Table>
    </DataTable.Root>
  );
}
