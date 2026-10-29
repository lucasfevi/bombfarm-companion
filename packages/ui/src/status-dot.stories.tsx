import type { Meta, StoryObj } from '@storybook/react';
import { StatusDot } from './status-dot';

const meta = {
  title: 'UI/StatusDot',
  component: StatusDot,
  args: {
    tone: 'live',
    label: 'Connected',
  },
} satisfies Meta<typeof StatusDot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Live: Story = {};

export const ColoredLabel: Story = {
  args: { tone: 'down', label: 'Offline', colorLabel: true },
};

export const ColoredWarnLabel: Story = {
  args: { tone: 'warn', label: 'Degraded', colorLabel: true },
};

export const WithNodeLabel: Story = {
  args: { tone: 'warn', label: <em>Degraded</em> },
};

export const WithRootAttributes: Story = {
  args: { id: 'connection-status', 'data-state': 'open' },
};
