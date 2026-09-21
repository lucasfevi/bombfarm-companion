import type { Meta, StoryObj } from '@storybook/react';
import { Dialog } from './index';

const meta = {
  title: 'UI/Dialog',
  component: Dialog.Root,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Dialog.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OpenStatic: Story = {
  render: () => (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Head>
            <Dialog.Title>Sample dialog</Dialog.Title>
            <Dialog.Close aria-label="Close">×</Dialog.Close>
          </Dialog.Head>
          <p className="m-0 text-sm text-muted">
            Generic body slot — no import or roster business logic.
          </p>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  ),
};

export const HeadBodyFooter: Story = {
  render: () => (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup className="!w-[min(92vw,34rem)]">
          <Dialog.Head className="-mx-4 mb-4 shrink-0 border-b border-line px-4 pb-3">
            <Dialog.Title className="text-lg">A long read with a fixed footer</Dialog.Title>
          </Dialog.Head>
          <Dialog.Body className="flex flex-col gap-3">
            {Array.from({ length: 12 }, (_, index) => (
              <p key={index} className="m-0 text-sm text-muted">
                Paragraph {index + 1} — the body scrolls inside the popup while the head and the
                footer stay where they are.
              </p>
            ))}
          </Dialog.Body>
          <Dialog.Footer>
            <button type="button" className="text-sm">
              Not now
            </button>
            <button type="button" className="text-sm font-semibold">
              Allow
            </button>
          </Dialog.Footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  ),
};
