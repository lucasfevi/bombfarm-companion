/**
 * Display numbers with a fixed separator style, independent of UI language:
 * `,` thousands · `.` decimal.
 */
export function formatNumber(value: number, decimals = 1): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Drop redundant `.0` before unit suffix (e.g. `90.0k` → `90k`). */
function trimCompactFraction(text: string): string {
  return text.replace(/\.0+(?=[km]|$)/, '');
}

/**
 * Compact metric display for dense chrome (hero strip): `90200` → `90.2k`,
 * `1_200_000` → `1.2m`. Values under 1k render with `formatNumber`.
 */
export function formatCompactNumber(value: number, decimals = 1): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  if (abs >= 1_000_000) {
    return `${sign}${trimCompactFraction((abs / 1_000_000).toFixed(decimals))}m`;
  }
  if (abs >= 1_000) {
    return `${sign}${trimCompactFraction((abs / 1_000).toFixed(decimals))}k`;
  }
  if (Number.isInteger(value)) return String(value);
  return formatNumber(value, decimals);
}
