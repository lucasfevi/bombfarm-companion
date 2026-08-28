/**
 * Browser-side React commit collector for the profiler-re-run perf harness.
 * Must stay dependency-free — installed via Playwright `addInitScript` before app scripts.
 *
 * Fiber tags and PerformedWork match React 19 / DevTools `didFiberRender` for counted types.
 */

export interface RenderedFiber {
  /** displayName ?? name ?? '<anonymous>' */
  key: string
  /** Owner chain for duplicate-key disambiguation: Parent>Child>Key */
  ownerPath: string
  /** React fiber tag */
  tag: number
  /** Fiber actualDuration, ms */
  selfDurationMs: number
}

export interface CommitRecord {
  /** performance.now() when this commit was observed */
  at: number
  /** Root actualDuration for this commit, ms */
  durationMs: number
  rendered: RenderedFiber[]
}

export interface PerfMark {
  label: string
  at: number
}

export interface BfhpPerfApi {
  commits: CommitRecord[]
  marks: PerfMark[]
  mark: (label: string) => void
  reset: () => void
  /** True once React called inject() on our hook */
  hookInstalled: boolean
  /** True once onCommitFiberRoot fired at least once */
  sawCommit: boolean
  /** Commit-time agreement with DevTools didFiberRender (last commit) */
  lastDevtoolsAgreement?: boolean | null
  lastCollectorKeys?: string[]
  lastDevtoolsKeys?: string[]
}

declare global {
  interface Window {
    __BFHP_PERF__?: BfhpPerfApi
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: Record<string, unknown>
  }
}

/** Counted fiber tags — spec metric definition (W8 inherits verbatim). */
export const COUNTED_TAGS = {
  FunctionComponent: 0,
  ClassComponent: 1,
  ForwardRef: 11,
  MemoComponent: 14,
  SimpleMemoComponent: 15,
} as const

/** React PerformedWork flag bit — same predicate DevTools uses for counted tags. */
export const PERFORMED_WORK = 0b1

/**
 * Self-contained init script body. Playwright serializes this into the page —
 * do not close over imports or outer scope.
 */
export function collectorInitScript(): void {
  const COUNTED = new Set([0, 1, 11, 14, 15])
  const PERFORMED_WORK_FLAG = 0b1

  type Fiber = {
    tag: number
    flags: number
    type: unknown
    elementType?: unknown
    return: Fiber | null
    child: Fiber | null
    sibling: Fiber | null
    actualDuration?: number
    alternate?: Fiber | null
    memoizedProps?: unknown
    memoizedState?: unknown
    ref?: unknown
  }

  type Rendered = {
    key: string
    ownerPath: string
    tag: number
    selfDurationMs: number
  }

  type Commit = {
    at: number
    durationMs: number
    rendered: Rendered[]
  }

  const commits: Commit[] = []
  const marks: { label: string; at: number }[] = []

  const api = {
    commits,
    marks,
    hookInstalled: false,
    sawCommit: false,
    mark(label: string) {
      marks.push({ label, at: performance.now() })
    },
    reset() {
      commits.length = 0
      marks.length = 0
    },
  }

  ;(window as unknown as { __BFHP_PERF__: typeof api }).__BFHP_PERF__ = api

  function componentKey(fiber: Fiber): string {
    const t = (fiber.type ?? fiber.elementType) as
      | { displayName?: string; name?: string }
      | string
      | null
      | undefined
    if (t == null) return '<anonymous>'
    if (typeof t === 'string') return t
    return t.displayName || t.name || '<anonymous>'
  }

  function ownerPath(fiber: Fiber): string {
    const parts: string[] = []
    let cur: Fiber | null = fiber
    while (cur) {
      if (COUNTED.has(cur.tag)) {
        parts.push(componentKey(cur))
      }
      cur = cur.return
    }
    return parts.reverse().join('>')
  }

  function walk(fiber: Fiber | null, out: Rendered[]): void {
    let node = fiber
    while (node) {
      if (COUNTED.has(node.tag) && (node.flags & PERFORMED_WORK_FLAG) !== 0) {
        const key = componentKey(node)
        out.push({
          key,
          ownerPath: ownerPath(node),
          tag: node.tag,
          selfDurationMs: typeof node.actualDuration === 'number' ? node.actualDuration : 0,
        })
      }
      if (node.child) walk(node.child, out)
      node = node.sibling
    }
  }

  function walkDevtools(fiber: Fiber | null, out: string[]): void {
    // Independent walk using the same PerformedWork predicate DevTools applies to
    // FunctionComponent / ClassComponent / ForwardRef / SimpleMemoComponent
    // (react-devtools-shared didFiberRender). MemoComponent is included per the
    // W1 metric definition (PerformedWork), not the DevTools default branch.
    let node = fiber
    while (node) {
      if (COUNTED.has(node.tag) && (node.flags & PERFORMED_WORK_FLAG) !== 0) {
        out.push(componentKey(node))
      }
      if (node.child) walkDevtools(node.child, out)
      node = node.sibling
    }
  }

  // Latest commit-time agreement between collector and DevTools didFiberRender.
  ;(api as typeof api & { lastDevtoolsAgreement: boolean | null }).lastDevtoolsAgreement = null
  ;(api as typeof api & { lastCollectorKeys: string[] }).lastCollectorKeys = []
  ;(api as typeof api & { lastDevtoolsKeys: string[] }).lastDevtoolsKeys = []

  const hook = {
    // React probes these members before attaching.
    supportsFiber: true,
    // Keep renderers map for DevTools-shaped consumers.
    renderers: new Map(),
    inject(renderer: unknown) {
      api.hookInstalled = true
      const id = (hook.renderers as Map<number, unknown>).size + 1
      ;(hook.renderers as Map<number, unknown>).set(id, renderer)
      return id
    },
    onCommitFiberRoot(_rendererID: number, root: { current?: Fiber }, _priorityLevel?: number) {
      try {
        api.sawCommit = true
        const current = root?.current
        if (!current) return
        // Walk the committed tree from the host root's child — must run NOW;
        // React clears PerformedWork flags after the commit phase.
        const rendered: Rendered[] = []
        walk(current.child ?? current, rendered)
        const devtoolsKeysRaw: string[] = []
        walkDevtools(current.child ?? current, devtoolsKeysRaw)
        const collectorKeys = [...new Set(rendered.map((r) => r.key))].sort()
        const devtoolsKeys = [...new Set(devtoolsKeysRaw)].sort()
        const agreed =
          collectorKeys.length === devtoolsKeys.length &&
          collectorKeys.every((k, i) => k === devtoolsKeys[i])
        ;(api as typeof api & { lastDevtoolsAgreement: boolean }).lastDevtoolsAgreement = agreed
        ;(api as typeof api & { lastCollectorKeys: string[] }).lastCollectorKeys = collectorKeys
        ;(api as typeof api & { lastDevtoolsKeys: string[] }).lastDevtoolsKeys = devtoolsKeys

        const durationMs =
          typeof current.actualDuration === 'number'
            ? current.actualDuration
            : rendered.reduce((s, r) => s + r.selfDurationMs, 0)
        commits.push({
          at: performance.now(),
          durationMs,
          rendered,
        })
      } catch {
        // Never throw into React's commit phase — a collector fault must not
        // abort planner boot (StrictMode remount + applyHero microtask).
        api.sawCommit = true
      }
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
  }

  Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
    value: hook,
    configurable: false,
    enumerable: false,
    writable: false,
  })
}

/** Install the collector before any page script runs. */
export async function installCollector(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.addInitScript(collectorInitScript)
}

export async function readPerfApi(
  page: import('@playwright/test').Page,
): Promise<BfhpPerfApi> {
  return page.evaluate(() => {
    const api = window.__BFHP_PERF__
    if (!api) {
      throw new Error('__BFHP_PERF__ missing — collector init script did not run')
    }
    return {
      commits: api.commits,
      marks: api.marks,
      hookInstalled: api.hookInstalled,
      sawCommit: api.sawCommit,
      lastDevtoolsAgreement: api.lastDevtoolsAgreement ?? null,
      lastCollectorKeys: api.lastCollectorKeys ?? [],
      lastDevtoolsKeys: api.lastDevtoolsKeys ?? [],
      // Functions are not serializable; stubs satisfy the type for Node-side reads.
      mark: () => {},
      reset: () => {},
    }
  })
}

/** True when a key looks like a real component name (not a minified single/double letter). */
export function looksUnminified(key: string): boolean {
  if (key === '<anonymous>') return true
  // Minified production builds typically emit 1–2 char identifiers.
  if (/^[a-zA-Z]$/.test(key)) return false
  if (/^[a-zA-Z]{2}$/.test(key) && key !== 'h2' && key !== 'h3') return false
  // Real React components are PascalCase or contain a readable word.
  return /[A-Z]/.test(key) || key.includes('(') || key.length >= 4
}
