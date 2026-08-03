import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { RankControl } from '@/shared/design-system';

const meta = {
  title: 'UI/RankControl',
  component: RankControl,
  tags: ['autodocs'],
  args: {
    label: 'Skill rank',
    value: 3,
    max: 10,
    onChange: () => undefined,
  },
} satisfies Meta<typeof RankControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render() {
    const [value, setValue] = useState(3);
    return (
      <RankControl
        label="Skill rank"
        value={value}
        max={10}
        onChange={setValue}
      />
    );
  },
};
