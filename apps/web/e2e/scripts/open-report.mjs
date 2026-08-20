#!/usr/bin/env node
/**
 * Open the local Playwright HTML report (after `pnpm test:e2e` in Docker).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PLAYWRIGHT_CLI = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
const REPORT_DIR = path.join(ROOT, 'playwright-report');

function findReportDir() {
  if (fs.existsSync(path.join(REPORT_DIR, 'index.html'))) return REPORT_DIR;
  if (!fs.existsSync(REPORT_DIR)) return null;
  for (const ent of fs.readdirSync(REPORT_DIR, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const candidate = path.join(REPORT_DIR, ent.name);
    if (fs.existsSync(path.join(candidate, 'index.html'))) return candidate;
  }
  return null;
}

function main() {
  const reportDir = findReportDir();
  if (!reportDir) {
    console.error(
      'No local Playwright report found.\n' +
        'Run `pnpm test:e2e` first (visual failures write playwright-report/).\n' +
        'To fetch a CI report instead: `pnpm test:e2e:report:ci`',
    );
    process.exit(1);
  }

  console.log(`Opening ${path.relative(ROOT, reportDir)} …`);
  const result = spawnSync(process.execPath, [PLAYWRIGHT_CLI, 'show-report', reportDir], {
    stdio: 'inherit',
  });
  process.exit(result.status ?? 1);
}

main();
