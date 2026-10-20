import type { Meta, StoryObj } from '@storybook/react';
import { Skeleton } from './skeleton';

const meta = {
  title: 'UI/Skeleton',
  component: Skeleton,
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Line: Story = {};

export const Block: Story = {
  args: { shape: 'block' },
};

export const TableRows: Story = {
  args: { shape: 'rows', rows: 4 },
};

export const Labelled: Story = {
  args: { shape: 'rows', rows: 3, label: 'Loading entries' },
};
