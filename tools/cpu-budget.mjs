import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

/**
 * One CPU budget for the whole machine, divided among the heavy runs currently executing.
 *
 * Every tool here already caps its own fan-out — `vitest.workers.ts` at 3 workers, Next's
 * export pool at 4, Playwright at 4, `pnpm -r` at 2 packages. Those caps bound ONE run. They
 * do not bound the machine, because nothing coordinates between processes: two checkouts (or
 * two terminals, or two agent sessions) running `pnpm test && pnpm build` each take their full
 * cap, and the demand multiplies until the machine stops being usable for anything else.
 *
 * The fix is a shared denominator rather than a smaller numerator. A run about to fan out
 * writes a lease into a machine-wide directory, counts the live leases, and takes
 * `budget / liveLeases` — so one run alone behaves exactly as it does today, and N runs split
 * the same budget N ways instead of each claiming it whole. A run that arrives late gets a
 * smaller share, never a queue position, so there is no lock to strand and no deadlock to hit.
 *
 * The one exception is the heavy-run slot below, and it exists because sharing is the wrong
 * shape for a full run. Four sessions each running the whole Vitest suite at once take a
 * quarter share each, finish together four times later, and hold four sets of TypeScript
 * programs and worker pools the entire time — the budget divides cores, not memory. Queuing
 * them has the same throughput, hands the first its result four times sooner, and keeps peak
 * memory at one run. So the full runs (an unscoped `vitest run`, the web e2e suite, the
 * Electron smoke suite) take one machine-wide slot before they fan out, and the scoped
 * everyday run never does — it stays on the share model and never waits on anything.
 *
 * Leases are reaped by liveness, not by discipline: a run killed with Ctrl-C leaves its file
 * behind, and the next reader drops it because the pid is gone. STALE_AFTER_MS is the backstop
 * for the one case liveness cannot see — the OS reusing a dead run's pid for an unrelated
 * process, which would otherwise keep a phantom lease alive indefinitely.
 *
 * Every failure mode here fails OPEN, back to the caller's own cap: an unwritable temp
 * directory, a malformed lease, a pid check that throws. Shrinking a run is an optimisation,
 * and an optimisation that can break the build is not worth having.
 *
 * NO `import.meta` IN THIS FILE, and no top-level side effects. `apps/web/playwright.config.ts`
 * imports it, and Playwright transpiles a config's local imports to CommonJS, where `import.meta`
 * is a SyntaxError — not at import time, but when Playwright loads the config, which is every
 * e2e run. That is why the `node tools/cpu-budget-report.mjs` diagnostic lives in its own file
 * rather than behind a main-module check here. `cpu-budget.test.mjs` guards this.
 */

const LEASE_DIR_ENV = 'BFC_CPU_LEASE_DIR';
const LEASE_ENV = 'BFC_CPU_LEASE';
const BUDGET_ENV = 'BFC_CPU_BUDGET';
const HEAVY_SLOT_ENV = 'BFC_HEAVY_SLOT';
const HEAVY_SLOT_FILE = 'heavy-run.lock';

/**
 * A lease older than this is dropped even if its pid still answers. Long enough that no real
 * run reaches it (the full local-checks sequence is minutes, not hours), short enough that a
 * pid recycled onto a dead lease cannot hold a share for a working day.
 */
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

/**
 * Share of the machine all Bomb Farm work may hold at peak, across every concurrent run.
 * A third leaves the browser, the editor, and the game the rest — these runs are background
 * work on a machine being used for other things, not a batch job that owns it.
 */
const BUDGET_FRACTION = 1 / 3;

/** Below this the division stops being worth doing: two runs of one worker each. */
const MIN_BUDGET = 2;

/**
 * CI runners are single-tenant — one job per runner, nothing to share with. Sharing there would
 * only shrink runs against a phantom, so the mechanism is bypassed entirely and every caller
 * keeps the cap it computed for itself.
 */
function sharingApplies() {
  return !process.env.CI;
}

/**
 * Machine-wide, so every checkout of this repo shares one directory. The full repo name rather
 * than a short prefix because the pre-push hygiene sweep matches `bombfarm-` followed by
 * anything that is not `companion`, and a shorter name would trip it on every run.
 */
function leaseDir() {
  return process.env[LEASE_DIR_ENV] || path.join(tmpdir(), 'bombfarm-companion-cpu-leases');
}

/**
 * Total cores this repo's work may hold at once, across every concurrent run.
 *
 * @returns {number}
 */
export function machineCpuBudget() {
  const override = Number(process.env[BUDGET_ENV]);
  if (Number.isFinite(override) && override >= 1) return Math.floor(override);
  return Math.max(MIN_BUDGET, Math.round(availableParallelism() * BUDGET_FRACTION));
}

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but belongs to someone else — still alive, still loaded.
    return error?.code === 'EPERM';
  }
}

/**
 * Live leases, reaping the dead ones on the way past. Reaping is best-effort by design:
 * concurrent runs scan the same directory, so losing the race to delete a file is the expected
 * case, not an error.
 */
function liveLeases() {
  const dir = leaseDir();
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const now = Date.now();
  const live = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const file = path.join(dir, entry);
    let lease;
    try {
      lease = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      lease = undefined;
    }
    const pid = Number(lease?.pid);
    const startedAt = Number(lease?.startedAt);
    const fresh = Number.isFinite(startedAt) && now - startedAt < STALE_AFTER_MS;
    if (Number.isFinite(pid) && fresh && processIsAlive(pid)) {
      live.push(lease);
      continue;
    }
    try {
      rmSync(file, { force: true });
    } catch {
      // Another run reaped it first.
    }
  }
  return live;
}

/**
 * Claim a lease unless this process already inherited one.
 *
 * The inheritance check is what keeps nesting honest. `pnpm build` spawns `pnpm -r build`
 * spawns `next build`, and Playwright and Vitest both re-load their config inside every worker
 * they start — without it a single run would count itself several times over and starve its own
 * fan-out. The lease id travels in the environment, so every descendant of the process that
 * claimed it reads the same share.
 */
function claimLease(kind) {
  if (process.env[LEASE_ENV]) return;
  const id = String(process.pid);
  const file = path.join(leaseDir(), `${id}.json`);
  try {
    mkdirSync(leaseDir(), { recursive: true });
    writeFileSync(file, JSON.stringify({ pid: process.pid, kind, startedAt: Date.now() }), 'utf8');
  } catch {
    return;
  }
  process.env[LEASE_ENV] = id;
  process.on('exit', () => {
    try {
      rmSync(file, { force: true });
    } catch {
      // Reaped by liveness on the next read.
    }
  });
}

/**
 * How many workers this run may start, given everything else running on the machine.
 *
 * `cap` is the caller's own ceiling — the measured critical path for Vitest, the export pool for
 * Next — and is never exceeded. This only ever lowers it, and never below 1.
 *
 * @param {number} cap
 * @param {string} kind Recorded in the lease, so the report below can say what holds a share.
 * @returns {number}
 */
export function cappedWorkers(cap, kind) {
  const ceiling = Math.max(1, Math.floor(cap));
  if (!sharingApplies()) return ceiling;
  claimLease(kind);
  const runs = Math.max(1, liveLeases().length);
  return Math.max(1, Math.min(ceiling, Math.floor(machineCpuBudget() / runs)));
}

function heavySlotFile() {
  return path.join(leaseDir(), HEAVY_SLOT_FILE);
}

/**
 * Whoever holds the heavy-run slot right now, or null. A holder whose pid is gone, or whose
 * file is older than the staleness backstop, is reaped here — the same liveness rule as the
 * leases, so a run killed with Ctrl-C cannot strand the next one.
 */
export function heavySlotHolder() {
  const file = heavySlotFile();
  let holder;
  try {
    holder = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    holder = undefined;
  }
  const pid = Number(holder?.pid);
  const startedAt = Number(holder?.startedAt);
  const fresh = Number.isFinite(startedAt) && Date.now() - startedAt < STALE_AFTER_MS;
  if (Number.isFinite(pid) && fresh && processIsAlive(pid)) return holder;
  try {
    rmSync(file, { force: true });
  } catch {
    // Another waiter reaped it first.
  }
  return null;
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Take the machine-wide heavy-run slot, waiting for the current holder to finish if there is
 * one. Synchronous on purpose: the callers are build and test configs, which are loaded before
 * any event loop the tool would let us yield to.
 *
 * Inherited like the lease: the slot id travels in the environment so a Vitest worker or a
 * Playwright worker re-loading the config inside the run does not queue behind its own parent.
 * Creation is `wx` (exclusive), so two waiters that both see the holder die race on the
 * filesystem and exactly one wins. Every failure fails open — an unwritable directory or a torn
 * file means the run goes ahead unqueued, which is slower, not broken.
 *
 * @param {string} kind Recorded in the slot file, so a waiter can say what it is waiting for.
 * @param {{ onWait?: (holder: object, waitedMs: number) => void, pollMs?: number }} [options]
 * @returns {{ waitedMs: number }}
 */
export function waitForHeavySlot(kind, { onWait = reportWaiting, pollMs = 1000 } = {}) {
  if (!sharingApplies() || process.env[HEAVY_SLOT_ENV]) return { waitedMs: 0 };
  const file = heavySlotFile();
  const startedWaitingAt = Date.now();
  try {
    mkdirSync(leaseDir(), { recursive: true });
  } catch {
    return { waitedMs: 0 };
  }
  let lastReportedAt = 0;
  let racesLost = 0;
  for (;;) {
    try {
      writeFileSync(file, JSON.stringify({ pid: process.pid, kind, startedAt: Date.now() }), { flag: 'wx' });
      break;
    } catch (error) {
      if (error?.code !== 'EEXIST') return { waitedMs: Date.now() - startedWaitingAt };
    }
    const holder = heavySlotHolder();
    if (!holder) {
      // The file existed a moment ago and is unreadable or reaped now: someone else is
      // mid-write, or we lost the reap race. A few retries settle it; beyond that the
      // directory is misbehaving, and a queue that cannot be trusted is not worth waiting on.
      racesLost += 1;
      if (racesLost > 5) return { waitedMs: Date.now() - startedWaitingAt };
      sleepSync(Math.min(pollMs, 50));
      continue;
    }
    const waitedMs = Date.now() - startedWaitingAt;
    if (waitedMs - lastReportedAt >= 30_000 || lastReportedAt === 0) {
      lastReportedAt = Math.max(1, waitedMs);
      onWait(holder, waitedMs);
    }
    sleepSync(pollMs);
  }
  process.env[HEAVY_SLOT_ENV] = String(process.pid);
  process.on('exit', () => releaseHeavySlot(file));
  return { waitedMs: Date.now() - startedWaitingAt };
}

function releaseHeavySlot(file) {
  try {
    if (Number(JSON.parse(readFileSync(file, 'utf8'))?.pid) === process.pid) rmSync(file, { force: true });
  } catch {
    // Already gone, or reaped as stale and taken by a successor — either way not ours to delete.
  }
}

function reportWaiting(holder, waitedMs) {
  const holderAgeSeconds = Math.round((Date.now() - Number(holder.startedAt)) / 1000);
  const waited = waitedMs >= 1000 ? `, waited ${Math.round(waitedMs / 1000)}s` : '';
  process.stderr.write(
    `waiting for the heavy-run slot: pid ${holder.pid} is running ${holder.kind} (${holderAgeSeconds}s)${waited}
`,
  );
}

/**
 * Read-only view of the machine's current state — claims nothing, so asking what is running
 * never changes what is running.
 */
export function cpuLeaseReport() {
  const leases = liveLeases();
  const budget = machineCpuBudget();
  return {
    budget,
    leaseDir: leaseDir(),
    sharingApplies: sharingApplies(),
    leases,
    sharePerRun: Math.max(1, Math.floor(budget / Math.max(1, leases.length))),
    heavySlot: heavySlotHolder(),
  };
}

