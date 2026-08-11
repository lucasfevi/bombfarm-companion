import type { Meta, StoryObj } from '@storybook/react';
import { StatusChip } from './status-chip';

const meta = {
  title: 'UI/StatusChip',
  component: StatusChip,
  tags: ['autodocs'],
} satisfies Meta<typeof StatusChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Connected: Story = {
  args: { status: 'connected', label: 'Connected' },
};

export const NotRunning: Story = {
  args: { status: 'not_running', label: 'Game not running' },
};

export const StaleWithAge: Story = {
  args: { status: 'stale', label: 'Stale', ageLabel: '3m' },
};

export const StaleWithoutAge: Story = {
  args: { status: 'stale', label: 'Stale' },
};
