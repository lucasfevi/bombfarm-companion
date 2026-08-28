import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

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
 * the same budget N ways instead of each claiming it whole. Nothing ever waits: a run that
 * arrives late gets a smaller share, never a queue position, so there is no lock to strand and
 * no deadlock to hit.
 *
 * Leases are reaped by liveness, not by discipline: a run killed with Ctrl-C leaves its file
 * behind, and the next reader drops it because the pid is gone. STALE_AFTER_MS is the backstop
 * for the one case liveness cannot see — the OS reusing a dead run's pid for an unrelated
 * process, which would otherwise keep a phantom lease alive indefinitely.
 *
 * Every failure mode here fails OPEN, back to the caller's own cap: an unwritable temp
 * directory, a malformed lease, a pid check that throws. Shrinking a run is an optimisation,
 * and an optimisation that can break the build is not worth having.
 */

const LEASE_DIR_ENV = 'BFC_CPU_LEASE_DIR';
const LEASE_ENV = 'BFC_CPU_LEASE';
const BUDGET_ENV = 'BFC_CPU_BUDGET';

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
 * @param {string} kind Recorded in the lease, so `node tools/cpu-budget.mjs` can say what holds a share.
 * @returns {number}
 */
export function cappedWorkers(cap, kind) {
  const ceiling = Math.max(1, Math.floor(cap));
  if (!sharingApplies()) return ceiling;
  claimLease(kind);
  const runs = Math.max(1, liveLeases().length);
  return Math.max(1, Math.min(ceiling, Math.floor(machineCpuBudget() / runs)));
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
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = cpuLeaseReport();
  const lines = [
    `budget        ${report.budget} of ${availableParallelism()} cores`,
    `lease dir     ${report.leaseDir}`,
    `sharing       ${report.sharingApplies ? 'on' : 'off (CI)'}`,
    `active runs   ${report.leases.length}`,
    `share per run ${report.leases.length ? report.sharePerRun : report.budget}`,
  ];
  for (const lease of report.leases) {
    const ageSeconds = Math.round((Date.now() - Number(lease.startedAt)) / 1000);
    lines.push(`  pid ${lease.pid} — ${lease.kind} (${ageSeconds}s)`);
  }
  process.stdout.write(`${lines.join('\n')}\n`);
}
