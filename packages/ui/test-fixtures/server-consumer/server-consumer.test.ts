import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import * as barrel from '../../src/index';
import { chunksContainingMotion, loadedChunks } from './chunk-scanner';

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

  it.each([
    ['Accordion', ['Accordion trigger one', 'Accordion trigger two', 'Accordion panel one']],
    ['Collapsible', ['Collapsible trigger', 'Collapsible panel text']],
    ['Tabs', ['Tab label one', 'Tab label two', 'Tab panel one']],
  ])('prerenders every part of the %s compound from a server component', (_name, content) => {
    const html = readPage('index.html');
    for (const text of content) expect(html).toContain(text);
  });

  it('can see motion in the chunks a page that needs the tooltip loads', () => {
    const chunks = loadedChunks(distDir, 'tooltip-nav.html');
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunksContainingMotion(distDir, chunks)).not.toEqual([]);
  });

  it('scans the chunks a plain nav page loads', () => {
    const chunks = loadedChunks(distDir, 'plain-nav.html');
    expect(chunks.length).toBeGreaterThan(0);
    expect(readPage('plain-nav.html')).toContain('<nav aria-label="Main"');
    const withMotion = chunksContainingMotion(distDir, chunks);
    console.info(`plain-nav motion chunks: ${withMotion.length === 0 ? 'none' : withMotion.join(', ')}`);
  });
});
