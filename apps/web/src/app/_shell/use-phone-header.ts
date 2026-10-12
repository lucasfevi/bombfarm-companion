"use client";

import { useSyncExternalStore } from "react";

const BELOW_SM = "(max-width: 639px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(BELOW_SM);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * True below Tailwind's `sm`, where the header's actions fold into one menu. A control renders in
 * exactly one place, so this picks the shape instead of hiding one with CSS — two copies of the
 * Import button or the referral chip would answer every test query twice. The static export is
 * drawn in the wide shape and corrected on hydration.
 */
export function usePhoneHeader() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(BELOW_SM).matches,
    () => false
  );
}
