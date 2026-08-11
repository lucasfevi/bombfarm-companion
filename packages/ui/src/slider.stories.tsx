import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Slider } from './index';

const meta = {
  title: 'UI/Slider',
  component: Slider,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render() {
    const [value, setValue] = useState(30);
    return (
      <div className="w-72">
        <Slider
          value={value}
          onValueChange={setValue}
          min={0}
          max={60}
          step={5}
          label="Price cache TTL"
          valueLabel={`${value} min`}
        />
      </div>
    );
  },
};

export const Disabled: Story = {
  args: { value: 20, min: 0, max: 100, label: 'Price cache TTL', valueLabel: '20 min', disabled: true },
  render: (args) => (
    <div className="w-72">
      <Slider {...args} />
    </div>
  ),
};
