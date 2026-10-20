import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import * as barrel from '../../src/index';
import { chunksContainingMotion, lazilyRequestedChunks, loadedChunks } from './chunk-scanner';

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(fixtureDir, '.next');
const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next');

interface BuildResult {
  code: number | null;
  output: string;
}

function buildFixture(): Promise<BuildResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [nextBin, 'build'], {
      cwd: fixtureDir,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NODE_ENV: 'production' },
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, output }));
  });
}

const readPage = (name: string) => readFileSync(path.join(distDir, 'server', 'app', name), 'utf8');

describe('a server-rendered consumer of the @bombfarm/ui barrel', () => {
  let build: BuildResult;

  beforeAll(async () => {
    build = await buildFixture();
  }, 240_000);

  it('builds with the whole barrel imported from a server component', () => {
    expect(build.code, build.output).toBe(0);
  });

  it('prerenders the barrel namespace, a server-safe component and a client component', () => {
    const html = readPage('index.html');
    const exported = Object.keys(barrel);
    expect(html).toContain(`<p data-testid="export-count">${exported.length}</p>`);
    expect(html).toContain('<li>Panel</li>');
    expect(html).toContain('<li>AppNav</li>');
    expect(html).toMatch(/<section[^>]*data-testid="server-panel"[^>]*>server panel<\/section>/);
    expect(html).toMatch(/<[^>]*role="combobox"[^>]*aria-label="Fixture select"/);
  });

  it('prerenders the text input and text area as plain form controls', () => {
    const html = readPage('index.html');
    expect(html).toMatch(/<input[^>]*class="w-full rounded-sm border border-line bg-bg-2 px-3 py-2 text-sm[^"]*"[^>]*placeholder="Type here"/);
    expect(html).toMatch(/<textarea[^>]*aria-invalid="true"[^>]*>Draft body<\/textarea>/);
  });

  it('prerenders the text link as a plain anchor', () => {
    const html = readPage('index.html');
    expect(html).toContain('<a class="text-accent underline-offset-2 hover:underline" href="/fixture-help">Fixture help link</a>');
  });

  it('prerenders the pagination as a nav of plain anchors', () => {
    const html = readPage('index.html');
    expect(html).toContain('<span class="text-muted tabular-nums">Page 2 of 3</span>');
    expect(html).toContain('href="/fixture-page/1" rel="prev">Previous</a>');
    expect(html).toContain('href="/fixture-page/3" rel="next">Next</a>');
  });

  it('prerenders the definition list, titled list and disclosure', () => {
    const html = readPage('index.html');
    expect(html).toContain('<div class="contents"><dt class="text-muted">Fixture term</dt><dd class="m-0 min-w-0 break-words">Fixture detail</dd></div>');
    expect(html).toContain('<section aria-label="Fixture list"');
    expect(html).toContain('>Fixture item</li>');
    expect(html).toMatch(/<details class="[^"]*"><summary class="[^"]*">Fixture summary<\/summary><div class="pt-2.5 pb-1">Fixture disclosure body<\/div><\/details>/);
  });

  it('prerenders the status dot, step progress and form toggle', () => {
    const html = readPage('index.html');
    expect(html).toContain('<span class="flex items-center gap-3" aria-live="polite">');
    expect(html).toContain('<span class="tabular-nums">Fixture status</span>');
    expect(html).toContain('<ol aria-label="Fixture steps"');
    expect(html).toContain('data-step="current" aria-current="step"');
    expect(html).toContain('<button type="submit" value="b" aria-pressed="true"');
    expect(html).toContain('name="fixture-range">Fixture B</button>');
  });

  it('prerenders the skeleton as a labelled busy region of hidden pulsing rows', () => {
    const html = readPage('index.html');
    expect(html).toContain('<div role="status" aria-busy="true" aria-label="Fixture loading"><div class="flex flex-col gap-2" aria-hidden="true">');
    expect(html).toContain('motion-safe:animate-pulse');
  });

  it('prerenders the error screen with its message and retry slot', () => {
    const html = readPage('index.html');
    expect(html).toContain('<h2 class="text-lg font-semibold text-ink">Fixture error</h2>');
    expect(html).toContain('<p class="m-0 max-w-prose text-sm text-muted">Fixture error message</p>');
    expect(html).toContain('<div class="mt-2"><a href="/fixture-retry">Retry</a></div>');
  });

  it('prerenders the native select with its options and the chosen one selected', () => {
    const html = readPage('index.html');
    expect(html).toMatch(/<select[^>]*class="w-full rounded-sm border border-line bg-bg-2 px-3 py-2 text-sm[^"]*"[^>]*aria-label="Fixture native select"/);
    expect(html).toMatch(/<option value="a">Alpha native<\/option><option value="b" selected="">Beta native<\/option>/);
  });

  it('prerenders the site header with its brand, nav strip and both action branches', () => {
    const html = readPage('index.html');
    expect(html).toMatch(/<header class="sticky top-0 z-30[^"]*"><div class="mx-auto flex max-w-app[^"]*">/);
    expect(html).toMatch(
      /<a href="\/" class="flex items-center gap-2\.5 no-underline max-sm:order-1"><svg[^>]*class="size-8\.5 shrink-0"[^>]*>.*?<\/svg><div><div class="text-sm leading-1\.1 font-bold text-ink">Acme<\/div><div class="text-\[11px\] tracking-\[0\.04em\] text-muted uppercase">Planner<\/div><\/div><\/a>/,
    );
    expect(html).toContain('fill="#17100c"');
    expect(html).toMatch(/<div class="max-sm:order-3 max-sm:w-full[^"]*"><nav aria-label="Header sections"/);
    expect(html).toMatch(/<div class="flex flex-nowrap[^"]*max-sm:hidden"><span>Header actions<\/span><\/div>/);
    expect(html).toMatch(/<div class="order-2 ml-auto sm:hidden"><details class="relative inline-block"/);
  });

  it('prerenders the site footer frame with its legal paragraph and trailing links', () => {
    const html = readPage('index.html');
    expect(html).toMatch(/<footer class="mx-auto mt-5 max-w-app px-4"><div class="flex flex-wrap[^"]*border-t border-line py-3">/);
    expect(html).toMatch(/<p class="m-0 flex min-w-0 flex-1[^"]*"><span>Acme legal line<\/span><\/p>/);
    expect(html).toMatch(/<div class="flex max-w-full shrink-0[^"]*"><a href="\/terms">Terms link<\/a><\/div>/);
  });

  it('prerenders the page frame with its slots in order and both section measures', () => {
    const html = readPage('index.html');
    expect(html).toContain(
      '<div class="flex min-h-screen flex-col"><p>Frame header</p><p>Frame notice</p><div class="relative flex-1">',
    );
    expect(html).toContain(
      '<div class="mx-auto grid max-w-app grid-cols-1 gap-3 px-4 pt-3">Default section</div>',
    );
    expect(html).toContain(
      '<div class="mx-auto grid max-w-settings grid-cols-1 gap-3 px-4 pt-3">Settings section</div></div><p>Frame footer</p><p>Frame overlay</p></div>',
    );
  });

  it('prerenders the disclosure menu closed, with its labelled summary and its items', () => {
    const html = readPage('index.html');
    expect(html).toMatch(/<details class="relative inline-block"><summary aria-label="Site menu"/);
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(html).toMatch(/<a href="\/reports" class="[^"]*">Reports link<\/a>/);
    expect(html).toMatch(/<button type="button" class="[^"]*">Sign out button<\/button>/);
  });

  it('prerenders the info banner in its flush layout with a title and text', () => {
    const html = readPage('index.html');
    expect(html).toMatch(/<div role="status" class="[^"]*border-line[^"]*bg-bg-2[^"]*">/);
    expect(html).toContain('>Fixture banner title</h2>');
    expect(html).toMatch(/<p class="[^"]*">Fixture banner text<\/p>/);
  });

  it('prerenders the inline empty state without an icon block', () => {
    const html = readPage('index.html');
    expect(html).toContain('<div class="flex flex-col items-center gap-1 px-3 py-4 text-center"><h2 class="text-[13px] font-semibold text-ink">Fixture empty title</h2>');
    expect(html).toContain('<p class="m-0 max-w-prose text-[13px] text-muted">Fixture empty description</p>');
  });

  it('prerenders the sort-link table header as an anchor inside an aria-sort th', () => {
    const html = readPage('index.html');
    expect(html).toMatch(/<th[^>]*aria-sort="ascending"[^>]*><a href="\/fixture-records\?sort=name&(?:amp;)?dir=desc"[^>]*><span>Fixture sort name<\/span>/);
  });

  it.each([
    ['Accordion', ['Accordion trigger one', 'Accordion trigger two', 'Accordion panel one']],
    ['Collapsible', ['Collapsible trigger', 'Collapsible panel text']],
    ['Tabs', ['Tab label one', 'Tab label two', 'Tab panel one']],
  ])('prerenders every part of the %s compound from a server component', (_name, content) => {
    const html = readPage('index.html');
    for (const text of content) expect(html).toContain(text);
  });

  it('reaches motion through the lazily requested chunks of a page that needs the tooltip', () => {
    const chunks = loadedChunks(distDir, 'tooltip-nav.html');
    expect(chunks.length).toBeGreaterThan(0);
    const lazy = lazilyRequestedChunks(distDir, chunks);
    expect(lazy.length).toBeGreaterThan(0);
    expect(chunksContainingMotion(distDir, lazy)).not.toEqual([]);
  });

  it('loads no motion on a page whose nav has only plain items', () => {
    const chunks = loadedChunks(distDir, 'plain-nav.html');
    expect(chunks.length).toBeGreaterThan(0);
    expect(readPage('plain-nav.html')).toContain('<nav aria-label="Main"');
    expect(chunksContainingMotion(distDir, chunks)).toEqual([]);
  });
});
