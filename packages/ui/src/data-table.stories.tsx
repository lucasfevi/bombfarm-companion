import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { DataTable, type SortDir } from '@/shared/design-system';

type DemoSortKey = 'name' | 'level' | 'dps';

const meta = {
  title: 'UI/DataTable',
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const rows = [
  { name: 'Wren', level: 42, dps: 47 },
  { name: 'Cora', level: 38, dps: 37 },
  { name: 'Brenna', level: 40, dps: 41 },
];

export const StaticHeaders: Story = {
  render: () => (
    <DataTable.Root scrollable maxRows={8} className="border border-line">
      <DataTable.Table>
        <DataTable.Head>
          <DataTable.Row>
            <DataTable.Header>Name</DataTable.Header>
            <DataTable.Header align="right">Level</DataTable.Header>
            <DataTable.Header align="right">DPS</DataTable.Header>
          </DataTable.Row>
        </DataTable.Head>
        <DataTable.Body>
          {rows.map((r) => (
            <DataTable.Row key={r.name}>
              <DataTable.Cell>{r.name}</DataTable.Cell>
              <DataTable.Cell align="right" numeric>
                {r.level}
              </DataTable.Cell>
              <DataTable.Cell align="right" numeric>
                {r.dps}
              </DataTable.Cell>
            </DataTable.Row>
          ))}
        </DataTable.Body>
      </DataTable.Table>
    </DataTable.Root>
  ),
};

function SortableDemo() {
  const [sortKey, setSortKey] = useState<DemoSortKey>('dps');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function onSort(key: DemoSortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1;
    if (sortKey === 'name') return mul * a.name.localeCompare(b.name);
    return mul * (a[sortKey] - b[sortKey]);
  });

  return (
    <DataTable.Root scrollable maxRows={8} className="border border-line">
      <DataTable.Table>
        <DataTable.Head>
          <DataTable.Row>
            <DataTable.Header sortable col="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort}>
              Name
            </DataTable.Header>
            <DataTable.Header
              sortable
              col="level"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              align="right"
            >
              Level
            </DataTable.Header>
            <DataTable.Header
              sortable
              col="dps"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              align="right"
            >
              DPS
            </DataTable.Header>
          </DataTable.Row>
        </DataTable.Head>
        <DataTable.Body>
          {sorted.map((r) => (
            <DataTable.Row key={r.name}>
              <DataTable.Cell>{r.name}</DataTable.Cell>
              <DataTable.Cell align="right" numeric>
                {r.level}
              </DataTable.Cell>
              <DataTable.Cell align="right" numeric>
                {r.dps}
              </DataTable.Cell>
            </DataTable.Row>
          ))}
        </DataTable.Body>
      </DataTable.Table>
    </DataTable.Root>
  );
}

export const SortableHeaders: Story = {
  render: () => <SortableDemo />,
};

export const NoScroll: Story = {
  render: () => (
    <DataTable.Root>
      <DataTable.Table>
        <DataTable.Head>
          <DataTable.Row>
            <DataTable.Header>Stat</DataTable.Header>
            <DataTable.Header align="right">Value</DataTable.Header>
          </DataTable.Row>
        </DataTable.Head>
        <DataTable.Body>
          <DataTable.Row>
            <DataTable.Cell>Attack</DataTable.Cell>
            <DataTable.Cell align="right" numeric>
              120
            </DataTable.Cell>
          </DataTable.Row>
          <DataTable.Row>
            <DataTable.Cell>Energy</DataTable.Cell>
            <DataTable.Cell align="right" numeric>
              80
            </DataTable.Cell>
          </DataTable.Row>
        </DataTable.Body>
      </DataTable.Table>
    </DataTable.Root>
  ),
};
