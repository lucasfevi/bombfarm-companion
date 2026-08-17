import type { Meta, StoryObj } from '@storybook/react';
import { Banner } from './banner';

const meta = {
  title: 'Design system/Banner',
  component: Banner,
  args: {
    tone: 'warn',
    layout: 'page',
    title: 'Finish setup before trusting the ranking',
    children: 'Pick a target prop and spend unallocated points.',
  },
} satisfies Meta<typeof Banner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Warn: Story = {};

export const Ok: Story = {
  args: {
    tone: 'ok',
    title: 'Setup complete — ranking is trustworthy',
    children: undefined,
  },
};

export const Embedded: Story = {
  args: {
    layout: 'embedded',
    title: undefined,
    children: 'Gale and Brick may gain from reallocating points — try Optimize build on Points.',
  },
};
