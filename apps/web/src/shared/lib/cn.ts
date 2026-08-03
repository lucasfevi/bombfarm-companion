import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class strings with clsx semantics and resolve conflicting Tailwind
 * utilities last-wins via tailwind-merge (mitigates the rule-10 foot-gun).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
