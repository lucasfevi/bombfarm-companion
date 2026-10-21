import type { Meta, StoryObj } from '@storybook/react';
import { LineChart } from './index';

const meta = {
  title: 'UI/Charts/Line',
  component: LineChart,
  tags: ['autodocs'],
  args: {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    ariaLabel: 'Daily visitors this week',
    empty: 'No visitors yet',
    series: [{ label: 'Visitors', values: [120, 180, 150, 240, 210, 320, 290] }],
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

export const Default: Story = {};

export const WithTable: Story = {
  args: { table: { summary: 'Show as table', labelHeading: 'Day' } },
};

export const CustomColour: Story = {
  args: { series: [{ label: 'Visitors', values: [120, 180, 150, 240, 210, 320, 290], color: 'var(--color-up)' }] },
};

export const SinglePoint: Story = {
  args: { labels: ['Mon'], series: [{ label: 'Visitors', values: [120] }] },
};

export const AllZero: Story = {
  args: { series: [{ label: 'Visitors', values: [0, 0, 0, 0, 0, 0, 0] }] },
};
