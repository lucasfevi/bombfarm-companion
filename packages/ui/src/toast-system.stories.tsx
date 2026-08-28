import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Button, ToastItem, ToastProvider, ToastViewport, useToast } from './index';
import type { ToastEntry } from './toast-queue';

const meta = {
  title: 'UI/Toast System',
  component: ToastItem,
  tags: ['autodocs'],
} satisfies Meta<typeof ToastItem>;

export default meta;
type Story = StoryObj<typeof meta>;

function entry(overrides: Partial<ToastEntry> & Pick<ToastEntry, 'variant' | 'title'>): ToastEntry {
  return {
    id: 'story-toast',
    key: 'story-toast',
    createdAt: 0,
    updatedAt: 0,
    expiresAt: null,
    ...overrides,
  };
}

export const Success: Story = {
  args: {
    toast: entry({ variant: 'success', title: 'Plan saved', description: 'Synced to browser storage.' }),
    onDismiss: () => {},
  },
};

export const ErrorVariant: Story = {
  name: 'Error',
  args: {
    toast: entry({
      variant: 'error',
      title: 'Connection lost',
      description: 'Game closed unexpectedly.',
      action: { label: 'Retry', onAction: () => {} },
    }),
    onDismiss: () => {},
  },
};

export const Warning: Story = {
  args: {
    toast: entry({ variant: 'warning', title: 'Save may be out of date', description: 'Re-import to refresh.' }),
    onDismiss: () => {},
  },
};

export const Info: Story = {
  args: {
    toast: entry({ variant: 'info', title: 'Update available', action: { label: 'Restart now', onAction: () => {} } }),
    onDismiss: () => {},
  },
};

export const Progress: Story = {
  args: {
    toast: entry({ variant: 'progress', title: 'Pricing pass', description: '32 of 80 items', progress: 40 }),
    onDismiss: () => {},
  },
};

/**
 * A `push()` with the same `key` replaces the live toast in place rather than
 * stacking (§11 dedup/coalesce) — this demo ticks a progress toast to 100%
 * and then replaces it with a completion summary of the same key.
 */
function CoalescingProgressDemo() {
  const { push } = useToast();
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return undefined;
    let pct = 0;
    const interval = setInterval(() => {
      pct += 20;
      if (pct >= 100) {
        push({ key: 'price-pass', variant: 'progress', title: 'Pricing pass', progress: 100 });
        window.setTimeout(() => {
          push({ key: 'price-pass', variant: 'success', title: 'Price pass complete', description: '80 items priced.' });
        }, 300);
        clearInterval(interval);
        setRunning(false);
        return;
      }
      push({ key: 'price-pass', variant: 'progress', title: 'Pricing pass', progress: pct });
    }, 500);
    return () => clearInterval(interval);
  }, [running, push]);

  return (
    <Button type="button" variant="primary" onClick={() => setRunning(true)} disabled={running}>
      Start price pass
    </Button>
  );
}

export const CoalescingProgress: Story = {
  render: () => (
    <ToastProvider>
      <CoalescingProgressDemo />
      <ToastViewport />
    </ToastProvider>
  ),
};

/** Beyond `MAX_VISIBLE_TOASTS` (3), the rest collapse into a "+N more" affordance that expands. */
function OverflowDemo() {
  const { push } = useToast();
  return (
    <Button
      type="button"
      variant="primary"
      onClick={() => {
        for (let i = 0; i < 6; i += 1) {
          push({ key: `catalog-update-${i}`, variant: 'info', title: `Catalog update ${i + 1}` });
        }
      }}
    >
      Push 6 toasts
    </Button>
  );
}

export const OverflowAffordance: Story = {
  render: () => (
    <ToastProvider>
      <OverflowDemo />
      <ToastViewport />
    </ToastProvider>
  ),
};
