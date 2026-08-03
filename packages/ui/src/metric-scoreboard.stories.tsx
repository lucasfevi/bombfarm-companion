import type { Meta, StoryObj } from '@storybook/react';
import { MetricScoreboard } from './index';

const meta = {
  title: 'UI/MetricScoreboard',
  component: MetricScoreboard,
  tags: ['autodocs'],
} satisfies Meta<typeof MetricScoreboard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithoutDelta: Story = {
  args: {
    'aria-label': 'Sustained · Hit',
    cells: [
      { id: 'dps-current', label: 'Sustained · Current', value: '1,234', tone: 'ink' },
      { id: 'hit-current', label: 'Hit · Current', value: '456', tone: 'ink' },
    ],
  },
};

export const WithDeltaUp: Story = {
  args: {
    'aria-label': 'Sustained · Hit',
    cells: [
      {
        id: 'dps-clone',
        label: 'Sustained · Alt',
        value: '1,300',
        tone: 'accent',
        delta: '+5.3%',
        deltaTone: 'up',
      },
    ],
  },
};

export const WithDeltaDown: Story = {
  args: {
    'aria-label': 'Sustained · Hit',
    cells: [
      {
        id: 'dps-clone',
        label: 'Sustained · Alt',
        value: '1,100',
        tone: 'accent',
        delta: '-4.1%',
        deltaTone: 'down',
      },
    ],
  },
};

export const FourCellScoreboard: Story = {
  args: {
    'aria-label': 'Sustained · Hit',
    cells: [
      { id: 'dps-current', label: 'Sustained · Current', value: '1,234', tone: 'ink' },
      { id: 'hit-current', label: 'Hit · Current', value: '456', tone: 'ink' },
      {
        id: 'dps-clone',
        label: 'Sustained · Alt',
        value: '1,300',
        tone: 'accent',
        delta: '+5.3%',
        deltaTone: 'up',
      },
      {
        id: 'hit-clone',
        label: 'Hit · Alt',
        value: '430',
        tone: 'accent',
        delta: '-5.7%',
        deltaTone: 'down',
      },
    ],
  },
};
