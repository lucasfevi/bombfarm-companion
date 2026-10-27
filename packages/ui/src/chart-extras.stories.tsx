import type { Meta, StoryObj } from '@storybook/react';
import { LineChart } from './index';

const meta = {
  title: 'UI/Charts/Detail, in-progress and whole-number ticks',
  component: LineChart,
  tags: ['autodocs'],
  args: {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    ariaLabel: 'Runs per day',
    empty: 'No runs yet',
    integerTicks: true,
    series: [{ label: 'Running', values: [1, 2, 2, 1, 2] }],
    details: [
      [{ label: 'accounts', value: '1' }],
      [{ label: 'accounts', value: '2' }, { label: 'anonymous', value: '0' }],
      undefined,
      [{ label: 'accounts', value: '1' }],
      [{ label: 'accounts', value: '2' }, { label: 'anonymous', value: '0' }],
    ],
    partial: { from: 4, label: '(in progress)' },
    table: { summary: 'Show as table', labelHeading: 'Day', detailColumns: true },
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

export const CountsWithDetail: Story = {};

export const AreaWithPartialRange: Story = {
  args: { fill: true, details: undefined, table: { summary: 'Show as table', labelHeading: 'Day' } },
};
