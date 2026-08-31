'use client';

import { useCallback, useMemo, useState } from 'react';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { heroPowerIndex } from '@bombfarm/domain/power';
import { DataTable, Tooltip } from '@bombfarm/ui';
import type { FarmRosterCopy, Lang } from '../../copy';
import { compareRosterHeroes } from '../../model/roster-compare';
import {
  RosterSortHeader,
  type RosterSortDir,
  type RosterSortKey,
} from './roster-sort-header';
import { HeroPickerRow } from './hero-picker-row';

export function HeroPickerTable({
  heroes,
  heroId,
  lang,
  t,
  formatNumber,
  onPick,
  onSetBattleAllowed,
}: {
  heroes: HeroRecord[];
  heroId: string | null;
  lang: Lang;
  t: FarmRosterCopy;
  formatNumber: (n: number, d?: number) => string;
  onPick: (h: HeroRecord) => void;
  onSetBattleAllowed?: (heroId: string, enabled: boolean) => void;
}) {
  const [sortKey, setSortKey] = useState<RosterSortKey>('power');
  const [sortDir, setSortDir] = useState<RosterSortDir>('desc');

  const powerById = useMemo(() => new Map(heroes.map((hero) => [hero.id, heroPowerIndex(hero)])), [heroes]);

  const sortedHeroes = useMemo(() => {
    const sorted = [...heroes];
    sorted.sort((left, right) => compareRosterHeroes(left, right, sortKey, sortDir, powerById));
    return sorted;
  }, [heroes, sortKey, sortDir, powerById]);

  const handleSort = useCallback(
    (key: RosterSortKey) => {
      if (sortKey === key) {
        setSortDir((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir(key === 'name' || key === 'rank' ? 'asc' : 'desc');
      }
    },
    [sortKey],
  );

  return (
    <Tooltip.Provider delay={200} closeDelay={80}>
      <DataTable.Root
        scrollable
        minRows={8}
        rowHeight="4.5rem"
        className="-mx-4 min-h-0 flex-1 border-y border-line"
      >
        <DataTable.Table>
          <DataTable.Head>
            <DataTable.Row>
              <DataTable.Header className="w-14" aria-label={t.heroAvatarCol}>
                <span className="sr-only">{t.heroAvatarCol}</span>
              </DataTable.Header>
              <RosterSortHeader
                col="rank"
                label={t.importColRank}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                className="w-10 max-[560px]:hidden"
              />
              <RosterSortHeader
                col="name"
                label={t.importColName}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <RosterSortHeader
                col="rarity"
                label={t.importColRarity}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                className="max-[560px]:hidden"
              />
              <RosterSortHeader
                col="level"
                label={t.importColLevel}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <RosterSortHeader
                col="power"
                label={t.importColPower}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                align="right"
                className="text-right"
              />
              <RosterSortHeader
                col="gear"
                label={t.rosterColGear}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                className="min-w-100 max-[720px]:hidden"
              />
              <DataTable.Header className="min-w-44 max-[960px]:hidden">
                {t.rosterColAbilities}
              </DataTable.Header>
              {onSetBattleAllowed ? (
                <DataTable.Header className="max-[720px]:hidden">{t.rosterColStatus}</DataTable.Header>
              ) : null}
            </DataTable.Row>
          </DataTable.Head>
          <DataTable.Body>
            {sortedHeroes.map((hero) => {
              const selected = hero.id === heroId;
              const powerShown = hero.power ?? powerById.get(hero.id) ?? 0;
              return (
                <HeroPickerRow
                  key={hero.id}
                  hero={hero}
                  selected={selected}
                  lang={lang}
                  t={t}
                  formatNumber={formatNumber}
                  powerShown={powerShown}
                  onPick={onPick}
                  onSetBattleAllowed={onSetBattleAllowed}
                />
              );
            })}
          </DataTable.Body>
        </DataTable.Table>
      </DataTable.Root>
    </Tooltip.Provider>
  );
}
