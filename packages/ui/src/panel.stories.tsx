import type { Meta, StoryObj } from '@storybook/react';
import { Panel } from './index';

const meta = {
  title: 'UI/Panel',
  component: Panel,
  tags: ['autodocs'],
  args: {
    children: <p className="m-0 text-sm text-muted">Panel body content.</p>,
  },
} satisfies Meta<typeof Panel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const Focus: Story = {
  args: { focus: true },
};

export const Need: Story = {
  args: { need: true },
};

export const Aligned: Story = {
  args: { aligned: true },
};

export const Unverified: Story = {
  args: { unverified: true },
};

export const FocusNeedUnverified: Story = {
  args: { focus: true, need: true, unverified: true },
};
