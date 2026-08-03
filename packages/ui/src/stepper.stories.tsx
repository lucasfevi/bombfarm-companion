import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Stepper } from '@/shared/design-system';

const meta = {
  title: 'UI/Stepper',
  component: Stepper,
  tags: ['autodocs'],
  args: {
    value: 12,
    onDecrement: () => undefined,
    onIncrement: () => undefined,
    decrementLabel: 'Decrease',
    incrementLabel: 'Increase',
  },
} satisfies Meta<typeof Stepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render() {
    const [value, setValue] = useState(12);
    return (
      <Stepper
        value={value}
        onDecrement={() => setValue((v) => Math.max(0, v - 1))}
        onIncrement={() => setValue((v) => v + 1)}
        decrementLabel="Decrease"
        incrementLabel="Increase"
      />
    );
  },
};
