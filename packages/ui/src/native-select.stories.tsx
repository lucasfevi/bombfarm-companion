import type { Meta, StoryObj } from '@storybook/react';
import { NativeSelect } from './index';

const meta = {
  title: 'UI/Native select',
  component: NativeSelect,
  render: (args) => (
    <NativeSelect {...args}>
      <option value="daily">Daily digest</option>
      <option value="weekly">Weekly digest</option>
      <option value="never">Never</option>
    </NativeSelect>
  ),
} satisfies Meta<typeof NativeSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { 'aria-label': 'Email frequency', defaultValue: 'weekly' },
};

export const Invalid: Story = {
  args: { 'aria-label': 'Email frequency', defaultValue: 'never', 'aria-invalid': true },
};

export const Disabled: Story = {
  args: { 'aria-label': 'Email frequency', defaultValue: 'daily', disabled: true },
};
