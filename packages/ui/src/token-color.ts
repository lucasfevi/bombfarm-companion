/** WCAG relative luminance + contrast helpers for token tests (TOK-09). */

export type Rgb = readonly [number, number, number];

const HEX_RE = /^#([0-9a-f]{6})$/i;
const OKLCH_RE = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/i;

function srgbChannel(linear: number): number {
  if (linear <= 0.0031308) return 12.92 * linear;
  return 1.055 * linear ** (1 / 2.4) - 0.055;
}

function oklabToLinearRgb(l: number, a: number, b: number): Rgb {
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;

  return [
    srgbChannel(+4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
    srgbChannel(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3),
    srgbChannel(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3),
  ];
}

function oklchToRgb(lPercent: number, c: number, hDeg: number): Rgb {
  const hRad = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);
  return oklabToLinearRgb(lPercent / 100, a, b);
}

export function parseColor(input: string): Rgb {
  const hex = HEX_RE.exec(input.trim());
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as unknown as Rgb;
  }

  const oklch = OKLCH_RE.exec(input.trim());
  if (oklch) {
    return oklchToRgb(Number(oklch[1]), Number(oklch[2]), Number(oklch[3]));
  }

  throw new Error(`Unsupported color format: ${input}`);
}

export function relativeLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    return c;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(parseColor(fg));
  const l2 = relativeLuminance(parseColor(bg));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
