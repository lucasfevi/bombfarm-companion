import type { Meta, StoryObj } from '@storybook/react';
import { BrandMark } from './brand-mark';

const meta = {
  title: 'UI/BrandMark',
  component: BrandMark,
  tags: ['autodocs'],
} satisfies Meta<typeof BrandMark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WebTone: Story = { args: { tone: 'web' } };
