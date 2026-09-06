'use client';

import { createContext, useContext } from 'react';

/** Whether the enclosing {@link DataTableRoot} is a scrollport, which is what decides between
 *  pinned and plain head chrome. Read by the head rather than passed down it, so a table that
 *  does not scroll stops paying for sticky chrome without every call site saying so. */
const DataTableScrollableContext = createContext(false);

export const DataTableScrollableProvider = DataTableScrollableContext.Provider;

export function useDataTableScrollable(): boolean {
  return useContext(DataTableScrollableContext);
}
