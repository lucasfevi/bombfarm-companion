import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { SearchSelectMultiple, type SearchSelectOption } from './index';

const COLUMNS: SearchSelectOption[] = [
  { value: 'rarity', label: 'Rarity' },
  { value: 'level', label: 'Level' },
  { value: 'power', label: 'Power' },
  { value: 'attack', label: 'Attack' },
  { value: 'energy', label: 'Energy' },
  { value: 'critChance', label: 'Crit chance' },
  { value: 'critDmg', label: 'Crit damage' },
  { value: 'cdr', label: 'Cooldown reduction' },
  { value: 'luck', label: 'Luck' },
];

const meta = {
  title: 'UI/SearchSelectMultiple',
  component: SearchSelectMultiple,
  tags: ['autodocs'],
  args: {
    size: 'compact',
    options: COLUMNS,
    value: [],
    onValueChange: () => undefined,
    renderValue: () => 'Columns',
    emptyLabel: 'No column matches.',
    searchPlaceholder: 'Find a column',
  },
} satisfies Meta<typeof SearchSelectMultiple>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render(args) {
    const [value, setValue] = useState<string[]>(['rarity', 'level', 'power', 'attack']);
    const everything = value.length === COLUMNS.length;
    return (
      <div className="max-w-[180px]">
        <SearchSelectMultiple
          {...args}
          aria-label="Columns"
          value={value}
          onValueChange={setValue}
          header={{
            label: 'Columns shown',
            action: everything
              ? { label: 'Hide all', onAction: () => setValue([]) }
              : { label: 'Show all', onAction: () => setValue(COLUMNS.map((column) => column.value)) },
          }}
        />
      </div>
    );
  },
};
