import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { SearchSelect, type SearchSelectOption } from './index';

const DIFFICULTIES = ['Easy', 'Normal', 'Hard', 'Very Hard', 'Inferno'];

/** Stand-in for the phase table: 600 rows, the size this control exists for. */
const MANY: SearchSelectOption[] = Array.from({ length: 600 }, (_, index) => {
  const phase = index + 1;
  const difficulty = DIFFICULTIES[Math.floor(index / 120)];
  const world = Math.floor((index % 120) / 10) + 1;
  return { value: String(phase), label: `${difficulty} ${world}-${(index % 10) + 1} (#${phase})` };
});

const meta = {
  title: 'UI/SearchSelect',
  component: SearchSelect,
  tags: ['autodocs'],
  args: {
    size: 'default',
    emptyLabel: 'No match.',
    searchPlaceholder: 'Type a name, a coordinate, or a number',
  },
} satisfies Meta<typeof SearchSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render(args) {
    const [value, setValue] = useState('151');
    return (
      <div className="max-w-xs">
        <SearchSelect
          {...args}
          aria-label="Phase"
          options={MANY}
          value={value}
          onValueChange={setValue}
          overflowLabel={(shown, matched) => `Showing ${shown} of ${matched} — keep typing.`}
        />
      </div>
    );
  },
};

export const WithNoneOption: Story = {
  render: function Render(args) {
    const [value, setValue] = useState('');
    return (
      <div className="max-w-xs">
        <SearchSelect
          {...args}
          aria-label="Phase"
          options={[{ value: '', label: 'None' }, ...MANY]}
          value={value}
          onValueChange={setValue}
          overflowLabel={(shown, matched) => `Showing ${shown} of ${matched} — keep typing.`}
        />
      </div>
    );
  },
};

export const Compact: Story = {
  args: { size: 'compact' },
  render: function Render(args) {
    const [value, setValue] = useState('3');
    return (
      <div className="max-w-[180px]">
        <SearchSelect
          {...args}
          aria-label="Rarity"
          options={[
            { value: '1', label: 'Common' },
            { value: '2', label: 'Rare' },
            { value: '3', label: 'Epic' },
            { value: '4', label: 'Legendary' },
          ]}
          value={value}
          onValueChange={setValue}
        />
      </div>
    );
  },
};
