import type { Meta, StoryObj } from '@storybook/react';
import { NotificationCenter, type NotificationCenterItem } from './index';

const meta = {
  title: 'UI/NotificationCenter',
  component: NotificationCenter,
  tags: ['autodocs'],
} satisfies Meta<typeof NotificationCenter>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleItems: NotificationCenterItem[] = [
  { id: '1', variant: 'success', title: 'Plan saved', timeLabel: 'just now' },
  {
    id: '2',
    variant: 'error',
    title: 'Connection lost',
    description: 'Game closed unexpectedly.',
    timeLabel: '2m ago',
  },
  { id: '3', variant: 'warning', title: 'Save may be out of date', timeLabel: '5m ago' },
  { id: '4', variant: 'info', title: 'Update available', timeLabel: '10m ago' },
  { id: '5', variant: 'success', title: 'Price pass complete', description: '80 items priced.', timeLabel: '1h ago' },
];

export const Full: Story = {
  args: {
    items: sampleItems,
    onDismiss: () => {},
    onClearAll: () => {},
    emptyLabel: 'No notifications yet',
  },
};

export const Empty: Story = {
  args: {
    items: [],
    onDismiss: () => {},
    emptyLabel: 'No notifications yet',
  },
};
