import { createContext, useContext } from 'react';

type TabsCtx = {
  activeValue: string | undefined;
  setActiveValue: (value: string) => void;
  layoutId: string;
};

export const TabsContext = createContext<TabsCtx | null>(null);

export function useTabsCtx(): TabsCtx {
  const context = useContext(TabsContext);
  if (!context) throw new Error('Tabs parts must be used inside Tabs.Root');
  return context;
}
