import type { Meta, StoryObj } from '@storybook/react';
import { Bar } from '@/shared/design-system';

const meta = {
  title: 'UI/Bar',
  component: Bar,
  tags: ['autodocs'],
  args: { percent: 65 },
} satisfies Meta<typeof Bar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Fill: Story = {
  args: { variant: 'fill' },
};

export const Best: Story = {
  args: { variant: 'best' },
};
