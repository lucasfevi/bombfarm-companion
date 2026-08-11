import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';
import { EmptyState } from './empty-state';

const meta = {
  title: 'UI/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  args: {
    icon: 'x-mark',
    title: 'No game running',
    description: 'Launch Bomb Farm to see your live gold, gems, and inventory here.',
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAction: Story = {
  args: {
    action: <Button variant="primary">Retry connection</Button>,
  },
};

export const WithoutAction: Story = {
  args: {},
};
