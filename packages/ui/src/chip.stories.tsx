import type { Meta, StoryObj } from '@storybook/react';
import { Chip } from './index';

const meta = {
  title: 'UI/Chip',
  component: Chip,
  tags: ['autodocs'],
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: 'Default', variant: 'default' },
};

export const On: Story = {
  args: { children: 'On', variant: 'on' },
};

export const Small: Story = {
  args: { children: 'Small', variant: 'small' },
};

export const SmallWarn: Story = {
  args: { children: 'Warn', variant: 'small-warn' },
};
