import type { Meta, StoryObj } from '@storybook/react';
import { DataTable } from './data-table';
import { Panel } from './panel';

function Examples() {
  return (
    <div className="flex flex-col gap-4">
      <Panel overflow="visible">Panel whose content may spill out of its edges.</Panel>
      <DataTable.Root>
        <DataTable.Table>
          <DataTable.Head>
            <DataTable.Row>
              <DataTable.Header sortable col="name" sortKey="name" sortDir="asc" sortHref="/records?sort=name&dir=desc">
                Name
              </DataTable.Header>
              <DataTable.Header sortable col="level" sortKey="name" sortDir="asc" sortHref="/records?sort=level&dir=asc">
                Level
              </DataTable.Header>
            </DataTable.Row>
          </DataTable.Head>
          <DataTable.Body>
            <DataTable.Row>
              <DataTable.Cell>Alpha</DataTable.Cell>
              <DataTable.Cell>3</DataTable.Cell>
            </DataTable.Row>
          </DataTable.Body>
        </DataTable.Table>
      </DataTable.Root>
    </div>
  );
}

const meta = {
  title: 'UI/Sort links and visible panel overflow',
  component: Examples,
} satisfies Meta<typeof Examples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
