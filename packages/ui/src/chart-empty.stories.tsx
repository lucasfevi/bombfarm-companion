import type { Meta, StoryObj } from '@storybook/react';
import { LineChart } from './index';

const meta = {
  title: 'UI/Charts/Empty',
  component: LineChart,
  tags: ['autodocs'],
  args: {
    labels: [],
    ariaLabel: 'Daily visitors this week',
    empty: 'No visitors yet',
    series: [],
  },
  decorators: [
    (Story) => (
      <div style={{ width: 640 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LineChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoSeries: Story = {};

export const OnlyGaps: Story = {
  args: { labels: ['Mon', 'Tue', 'Wed'], series: [{ label: 'Visitors', values: [null, null, null] }] },
};
