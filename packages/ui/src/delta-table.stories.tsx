import type { Meta, StoryObj } from '@storybook/react';
import { DeltaTable } from './index';

const meta = {
  title: 'UI/DeltaTable',
  component: DeltaTable,
  tags: ['autodocs'],
} satisfies Meta<typeof DeltaTable>;

export default meta;
type Story = StoryObj<typeof meta>;

const columnLabels = { label: 'Stat', now: 'Before', target: 'After', change: 'Δ' };

export const MixedDeltas: Story = {
  args: {
    caption: 'Stat changes',
    columnLabels,
    decimals: 0,
    rows: [
      { id: 'attack', label: 'Attack', now: 120, target: 161 },
      { id: 'energy', label: 'Energy', now: 80, target: 80 },
      { id: 'speed', label: 'Speed', now: 90, target: 19 },
    ],
  },
};

export const WithDecimals: Story = {
  args: {
    caption: 'Combat stats',
    columnLabels: { label: 'Stat', now: 'Current', target: 'Target', change: 'Change' },
    decimals: 2,
    rows: [
      { id: 'critChance', label: 'Crit Chance', now: 42.5, target: 55.25 },
      { id: 'critDmg', label: 'Crit Damage', now: 180, target: 174.4 },
    ],
  },
};

export const LockedRow: Story = {
  args: {
    caption: 'Per-hero split',
    columnLabels: { label: 'Stat', now: 'Current', target: 'Target', change: 'Change' },
    decimals: 0,
    rows: [
      { id: 'attack', label: 'Attack', now: 10, target: 42 },
      {
        id: 'luck',
        label: 'Luck',
        now: 7,
        target: 7,
        locked: true,
        lockLabel: 'Keep',
        lockHint: "Luck is left alone on purpose — this planner never moves it.",
      },
    ],
  },
};

export const HidesZeroRows: Story = {
  args: {
    caption: 'Points spent',
    columnLabels,
    decimals: 0,
    hideZeroRows: true,
    rows: [
      { id: 'attack', label: 'Attack', now: 10, target: 12 },
      { id: 'energy', label: 'Energy', now: 0, target: 0 },
      { id: 'speed', label: 'Speed', now: 5, target: 5 },
    ],
  },
};
