/**
 * Renders one share card per site section into `public/og/`, plus `public/og.png` as the
 * fallback for links shared before the per-section cards existed.
 *
 * The cards are generated rather than hand-drawn because the hand-drawn one went stale: its
 * SVG source was renamed and the PNG that every shared link actually served was never
 * re-rendered, so the site advertised a name it had dropped. `og-manifest.json` records the
 * copy each PNG was drawn from, and `src/tests/link-preview.test.ts` fails when they disagree.
 *
 *   pnpm --filter @bombfarm/web og
 *
 * Needs network: the cards are set in IBM Plex Sans, the same face the site loads, and the run
 * fails rather than falling back to a system font that would silently change every card.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(projectRoot, 'public', 'og');

const WIDTH = 1200;
const HEIGHT = 630;

/** `packages/ui/src/styles.css` design tokens, resolved from oklch to sRGB. */
const TOKEN = {
  bg: '#17100c',
  bg2: '#221813',
  surface: '#261d19',
  ink: '#efe6e1',
  muted: '#a99b94',
  line: '#443832',
  accent: '#e78a45',
};

const FOOTER_NOTE = 'Unofficial fan tool · Not affiliated with Bomb Farm';
const FOOTER_URL = 'bombfarm-companion.vercel.app';

/**
 * Must agree with `sectionSlug()` in `src/shared/lib/site-metadata.ts`, which derives the same
 * name from the route instead. The two cannot share a module across the .ts/.mjs line, so
 * `src/tests/link-preview.test.ts` asserts the files written here are exactly the ones the
 * metadata asks for — a disagreement fails there rather than shipping a missing card.
 */
function sectionSlug(section) {
  return section.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function escapeHtml(value) {
  return value.replace(
    /[&<>"]/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char],
  );
}

function cardHtml(preview) {
  const headline = preview.cardHeadline.map((line) => `<span>${escapeHtml(line)}</span>`).join('');
  const chips = preview.cardChips
    .map((chip) => `<li><i></i>${escapeHtml(chip)}</li>`)
    .join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;700&family=IBM+Plex+Mono:wght@500&display=block" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden;
    font-family: 'IBM Plex Sans', sans-serif; color: ${TOKEN.ink};
    background: linear-gradient(135deg, ${TOKEN.bg} 0%, ${TOKEN.bg} 45%, ${TOKEN.bg2} 100%);
  }
  .card { position: relative; width: 100%; height: 100%; padding: 76px 80px; display: flex; flex-direction: column; }
  .grid, .glow { position: absolute; inset: 0; }
  .grid {
    background-image: linear-gradient(${TOKEN.ink} 1px, transparent 1px),
                      linear-gradient(90deg, ${TOKEN.ink} 1px, transparent 1px);
    background-size: 48px 48px; opacity: 0.035;
  }
  .glow { background: radial-gradient(820px 560px at 90% 2%, ${TOKEN.accent}4a 0%, ${TOKEN.accent}12 42%, ${TOKEN.accent}00 72%); }
  .card > *:not(.grid):not(.glow) { position: relative; }

  .brand { display: flex; align-items: center; gap: 16px; }
  .brand svg { width: 40px; height: 40px; display: block; }
  .brand b { font-weight: 700; font-size: 20px; letter-spacing: 0.16em; text-transform: uppercase; color: ${TOKEN.muted}; }
  .brand em { font-style: normal; font-weight: 700; font-size: 20px; letter-spacing: 0.16em; text-transform: uppercase; color: ${TOKEN.accent}; }
  .brand s { text-decoration: none; color: ${TOKEN.line}; font-size: 20px; }

  h1 { margin-top: auto; font-size: 68px; line-height: 1.14; font-weight: 700; letter-spacing: -0.022em; display: flex; flex-direction: column; }
  .rule { margin: 34px 0 30px; width: 96px; height: 5px; border-radius: 3px; background: ${TOKEN.accent}; }

  ul { margin-bottom: auto; list-style: none; display: flex; gap: 14px; }
  li {
    display: flex; align-items: center; gap: 11px;
    padding: 12px 22px; border: 1px solid ${TOKEN.line}; border-radius: 999px;
    background: ${TOKEN.surface}; color: ${TOKEN.ink};
    font-size: 24px; font-weight: 500; white-space: nowrap; flex: 0 0 auto;
  }
  li i { width: 9px; height: 9px; border-radius: 50%; background: ${TOKEN.accent}; }

  footer { display: flex; align-items: baseline; justify-content: space-between; color: ${TOKEN.muted}; font-size: 21px; }
  footer code { font-family: 'IBM Plex Mono', monospace; font-weight: 500; color: #6b5a50; }
</style></head>
<body><div class="card">
  <div class="grid"></div><div class="glow"></div>
  <div class="brand">
    <svg viewBox="7.5 4.5 19 22" xmlns="http://www.w3.org/2000/svg">
      <circle cx="17" cy="17" r="8.5" fill="${TOKEN.accent}"/>
      <circle cx="17" cy="17" r="4.2" fill="${TOKEN.bg}"/>
      <rect x="15.2" y="5.5" width="3.6" height="5" rx="1.2" fill="${TOKEN.ink}"/>
    </svg>
    <b>Bomb Farm Companion</b><s>/</s><em>${escapeHtml(preview.eyebrow)}</em>
  </div>
  <h1>${headline}</h1>
  <div class="rule"></div>
  <ul>${chips}</ul>
  <footer><span>${escapeHtml(FOOTER_NOTE)}</span><code>${FOOTER_URL}</code></footer>
</div></body></html>`;
}

const previews = JSON.parse(
  await readFile(path.join(projectRoot, 'src/shared/lib/site-previews.json'), 'utf8'),
);

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

try {
  for (const [section, preview] of Object.entries(previews)) {
    await page.setContent(cardHtml(preview), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);

    const hasWebFont = await page.evaluate(() => document.fonts.check('700 68px "IBM Plex Sans"'));
    if (!hasWebFont) {
      throw new Error(
        'IBM Plex Sans did not load — the cards would render in a fallback face and silently ' +
          'stop matching the site. Check network access to fonts.googleapis.com and re-run.',
      );
    }

    const spill = await page.evaluate(() => {
      const card = document.querySelector('.card');
      const cardBox = card.getBoundingClientRect();
      const pad = getComputedStyle(card);
      const area = {
        top: cardBox.top + parseFloat(pad.paddingTop),
        left: cardBox.left + parseFloat(pad.paddingLeft),
        right: cardBox.right - parseFloat(pad.paddingRight),
        bottom: cardBox.bottom - parseFloat(pad.paddingBottom),
      };
      return [...document.querySelectorAll('.brand > *, h1 span, .rule, ul li, footer > *')]
        .map((el) => ({ el, box: el.getBoundingClientRect() }))
        .filter(
          ({ box }) =>
            box.top < area.top - 1 ||
            box.left < area.left - 1 ||
            box.right > area.right + 1 ||
            box.bottom > area.bottom + 1,
        )
        .map(({ el, box }) => `"${el.textContent.trim() || el.tagName}" reaches ${Math.round(box.right)}px`);
    });
    if (spill.length > 0) {
      throw new Error(
        `${section}: card content spills out of the ${WIDTH}x${HEIGHT} safe area — ` +
          `${spill.join('; ')}. Shorten a chip or a headline line.`,
      );
    }

    const file = path.join(outDir, `${sectionSlug(section)}.png`);
    await page.screenshot({ path: file });
    console.log(`og: ${path.relative(projectRoot, file)}`);

    if (section === 'planner') {
      const fallback = path.join(projectRoot, 'public', 'og.png');
      await page.screenshot({ path: fallback });
      console.log(`og: ${path.relative(projectRoot, fallback)} (fallback for older shared links)`);
    }
  }
} finally {
  await browser.close();
}

await writeFile(
  path.join(projectRoot, 'scripts', 'og-manifest.json'),
  `${JSON.stringify({ renderedFrom: previews }, null, 2)}\n`,
  'utf8',
);
console.log('og: scripts/og-manifest.json');
