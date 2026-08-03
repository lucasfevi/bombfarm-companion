import type { Meta, StoryObj } from '@storybook/react';
import { GlossedText } from '@/shared/design-system';

const meta = {
  title: 'UI/GlossedText',
  component: GlossedText,
  tags: ['autodocs'],
} satisfies Meta<typeof GlossedText>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoTerms: Story = {
  args: {
    template: 'dmg × mitF × hit',
    terms: new Map(),
  },
};

export const SingleTerm: Story = {
  args: {
    template: 'atk × mit × damage',
    terms: new Map([['mit', 'Damage mitigation applied before crit rolls.']]),
  },
};

export const OverlappingTokensWrapLongestFirst: Story = {
  args: {
    template: 'tree × extra × abl',
    terms: new Map([
      ['tree', 'Tree Speed bonus contribution.'],
      ['extra', 'Extra flat damage from gear.'],
      ['abl', 'Sheet-ability damage contribution.'],
    ]),
  },
};
