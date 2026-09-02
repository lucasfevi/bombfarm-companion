/**
 * Keeps the web download page's drawing of the Live screen tied to the screen it draws.
 *
 * The page at `/download` shows a replica of the desktop app's Live tab. It has to be a replica
 * and not the real thing: the web app's boundaries forbid importing from `apps/desktop`, and the
 * desktop speaks its own bilingual copy layer (`docs/i18n.md`), so both the labels and the layout
 * are a second copy of something that already exists. A second copy with nothing watching it
 * drifts, and a marketing page that quietly stops matching the product is worse than no picture.
 *
 * Layout fidelity cannot be asserted from here — nothing can diff a drawing against a React tree
 * across an app boundary. What can be asserted is the two things that change underneath it:
 *
 *   1. Every label the replica mirrors still exists in the desktop shell's copy, with the same
 *      value, in both languages.
 *   2. The Live screen is still built from the same set of components. A new panel, a removed
 *      one, or a rename means the drawing is now of an older screen, and a human has to look.
 *
 * The version the page advertises is deliberately NOT guarded here. It used to be, against
 * `apps/desktop/package.json` — and that pin was guarding a fiction: the published beta tags run
 * ahead of the package version, so it agreed with neither the installer nor the release. The page
 * now resolves the release from GitHub at runtime and writes no version down, which is the only
 * version of this that cannot go stale.
 *
 * When (2) fails, update the replica to match, then update LIVE_COMPONENTS below in the same
 * commit. Re-pinning it without touching the replica is the one move that defeats this file.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8');

const DESKTOP_COPY = {
  en: 'apps/desktop/renderer/lib/copy/en.ts',
  pt: 'apps/desktop/renderer/lib/copy/pt-BR.ts',
};
const REPLICA_COPY = 'apps/web/src/features/download/model/live-replica-copy.ts';
const LIVE_DIR = 'apps/desktop/renderer/app/live';
const MINI_LIVE_DIR = 'apps/desktop/renderer/app/mini-live';

/**
 * The Live screen's parts, as of the replica's last review. Filenames rather than exported
 * symbols: this guard reads source text, and a filename is the one thing a rename cannot hide.
 */
const LIVE_COMPONENTS = [
  'countdown-value.tsx',
  'earnings-panel.tsx',
  'energy-bar.tsx',
  'field-countdown.tsx',
  'freshness-line.tsx',
  'hero-row.tsx',
  'live-panel.tsx',
  'live-view.tsx',
  'map-panel.tsx',
  'never-read-empty-state.tsx',
  'recovery-countdown.tsx',
  'state-summary-bar.tsx',
  'waiting-flavor-line.tsx',
];

/**
 * The compact Live window's parts, as of the download page's mini section last review. The page
 * draws that window too, at its own density, so it goes stale the same way the full-size drawing
 * does and gets the same pin.
 */
const MINI_LIVE_COMPONENTS = [
  'mini-chrome.tsx',
  'mini-earnings.tsx',
  'mini-gear.tsx',
  'mini-heroes.tsx',
  'mini-map.tsx',
  'mini-skeleton.tsx',
  'page.tsx',
];

/** `key: 'value',` on one line. Every mirrored label is a short single-line string by design. */
function readStringLiteral(source, key) {
  const pattern = new RegExp(`^\\s*${key}:\\s*'((?:[^'\\\\]|\\\\.)*)',?\\s*$`, 'm');
  const match = pattern.exec(source);
  if (match === null) return null;
  return match[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
}

function mirroredEntries() {
  const source = read(REPLICA_COPY);
  const block = /const MIRRORED = \{([\s\S]*?)\n\} as const;/.exec(source);
  if (block === null) {
    throw new Error(`Could not find the MIRRORED block in ${REPLICA_COPY}`);
  }
  const entries = [];
  const pattern = /^\s*(\w+):\s*\{\s*en:\s*'((?:[^'\\]|\\.)*)',\s*pt:\s*'((?:[^'\\]|\\.)*)'\s*\},?\s*$/gm;
  let match;
  while ((match = pattern.exec(block[1])) !== null) {
    entries.push({
      key: match[1],
      en: match[2].replace(/\\'/g, "'"),
      pt: match[3].replace(/\\'/g, "'"),
    });
  }
  return entries;
}

describe('download page — Live replica drift', () => {
  const entries = mirroredEntries();

  it('mirrors at least the panels the replica draws', () => {
    expect(entries.length).toBeGreaterThan(10);
  });

  it('every mirrored label still exists in the desktop shell, both languages', () => {
    const sources = { en: read(DESKTOP_COPY.en), pt: read(DESKTOP_COPY.pt) };
    const missing = [];
    for (const entry of entries) {
      for (const lang of ['en', 'pt']) {
        if (readStringLiteral(sources[lang], entry.key) === null) {
          missing.push(`${entry.key} (${lang})`);
        }
      }
    }
    expect(missing, `absent from the desktop copy — the replica mirrors keys that no longer exist`).toEqual([]);
  });

  it('every mirrored label still reads exactly as the desktop prints it', () => {
    const sources = { en: read(DESKTOP_COPY.en), pt: read(DESKTOP_COPY.pt) };
    const drifted = [];
    for (const entry of entries) {
      for (const lang of ['en', 'pt']) {
        const desktopValue = readStringLiteral(sources[lang], entry.key);
        if (desktopValue !== null && desktopValue !== entry[lang]) {
          drifted.push(`${entry.key} (${lang}): replica ${JSON.stringify(entry[lang])} vs desktop ${JSON.stringify(desktopValue)}`);
        }
      }
    }
    expect(drifted, `update ${REPLICA_COPY} to match the desktop shell`).toEqual([]);
  });

  it('the Live screen is still built from the components the replica was drawn against', () => {
    const present = readdirSync(resolve(root, LIVE_DIR))
      .filter((name) => name.endsWith('.tsx') && !name.endsWith('.test.tsx'))
      .sort();
    expect(
      present,
      `the Live screen changed shape — review apps/web/src/features/download/components/live/live-replica.tsx, then re-pin LIVE_COMPONENTS`,
    ).toEqual([...LIVE_COMPONENTS].sort());
  });

  it('the compact Live window is still built from the components the mini section was drawn against', () => {
    const present = readdirSync(resolve(root, MINI_LIVE_DIR))
      .filter((name) => name.endsWith('.tsx') && !name.endsWith('.test.tsx'))
      .sort();
    expect(
      present,
      `the compact Live window changed shape — review apps/web/src/features/download/components/mini-live/mini-window-frame.tsx, then re-pin MINI_LIVE_COMPONENTS`,
    ).toEqual([...MINI_LIVE_COMPONENTS].sort());
  });

});
