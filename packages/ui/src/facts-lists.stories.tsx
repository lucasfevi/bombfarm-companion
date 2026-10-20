import type { Meta, StoryObj } from '@storybook/react';
import { DefinitionList } from './definition-list';
import { Disclosure } from './disclosure';
import { TitledList } from './titled-list';

const FACTS = [
  { term: 'Plan', detail: 'Annual' },
  { term: 'Seats', detail: '4' },
  { term: 'Renews', detail: '2026-11-02' },
];

const meta = {
  title: 'UI/Facts and lists',
  parameters: { layout: 'padded' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Facts: Story = {
  render: () => <DefinitionList items={FACTS} />,
};

export const RuledFacts: Story = {
  render: () => <DefinitionList items={FACTS} variant="ruled" />,
};

export const WithItems: Story = {
  render: () => <TitledList title="Recent events" items={['Signed in', 'Changed a setting']} empty="Nothing yet" />,
};

export const Empty: Story = {
  render: () => <TitledList title="Recent events" items={[]} empty="Nothing yet" />,
};

export const Closed: Story = {
  render: () => <Disclosure summary="Show details">Additional details appear here.</Disclosure>,
};

export const Open: Story = {
  render: () => (
    <Disclosure summary="Show details" defaultOpen>
      Additional details appear here.
    </Disclosure>
  ),
};
