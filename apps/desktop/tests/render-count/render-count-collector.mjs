/**
 * React commit collector for the Electron smoke suite. Same approach as the web planner's
 * Playwright perf harness (React DevTools global hook, walking committed fibers for the
 * PerformedWork flag) — reimplemented here rather than imported across the app boundary,
 * because `collectorInitScript()` bodies must stay dependency-free and self-contained (they are
 * serialized into the page by Playwright, not run as a normal module), and because the desktop
 * app and the web planner are separate Next.js apps with no existing shared package for
 * test-only tooling. A cross-app relative import would be the only alternative and would leak
 * one app's test internals into the other's package boundary for a ~100-line function; a new
 * published package is not warranted for test-only code either.
 */

/** Counted fiber tags — FunctionComponent, ClassComponent, ForwardRef, Memo, SimpleMemo. */
export const COUNTED_TAGS = {
  FunctionComponent: 0,
  ClassComponent: 1,
  ForwardRef: 11,
  MemoComponent: 14,
  SimpleMemoComponent: 15,
};

/** React's PerformedWork fiber flag bit. */
export const PERFORMED_WORK = 0b1;

/**
 * Self-contained init script body — Playwright serializes this function into the page before
 * any app script runs. Must not close over outer scope.
 */
export function collectorInitScript() {
  const COUNTED = new Set([0, 1, 11, 14, 15]);
  const PERFORMED_WORK_FLAG = 0b1;

  const commits = [];
  const marks = [];

  const api = {
    commits,
    marks,
    hookInstalled: false,
    sawCommit: false,
    mark(label) {
      marks.push({ label, at: performance.now() });
    },
    reset() {
      commits.length = 0;
      marks.length = 0;
    },
  };

  window.__BFC_RENDER_COUNT__ = api;

  function componentKey(fiber) {
    const t = fiber.type ?? fiber.elementType;
    if (t == null) return '<anonymous>';
    if (typeof t === 'string') return t;
    return t.displayName || t.name || '<anonymous>';
  }

  function ownerPath(fiber) {
    const parts = [];
    let cur = fiber;
    while (cur) {
      if (COUNTED.has(cur.tag)) parts.push(componentKey(cur));
      cur = cur.return;
    }
    return parts.reverse().join('>');
  }

  function walk(fiber, out) {
    let node = fiber;
    while (node) {
      if (COUNTED.has(node.tag) && (node.flags & PERFORMED_WORK_FLAG) !== 0) {
        out.push({
          key: componentKey(node),
          ownerPath: ownerPath(node),
          tag: node.tag,
          selfDurationMs: typeof node.actualDuration === 'number' ? node.actualDuration : 0,
        });
      }
      if (node.child) walk(node.child, out);
      node = node.sibling;
    }
  }

  const hook = {
    supportsFiber: true,
    renderers: new Map(),
    inject(renderer) {
      api.hookInstalled = true;
      const id = hook.renderers.size + 1;
      hook.renderers.set(id, renderer);
      return id;
    },
    onCommitFiberRoot(_rendererID, root) {
      try {
        api.sawCommit = true;
        const current = root && root.current;
        if (!current) return;
        const rendered = [];
        walk(current.child ?? current, rendered);
        const durationMs =
          typeof current.actualDuration === 'number'
            ? current.actualDuration
            : rendered.reduce((s, r) => s + r.selfDurationMs, 0);
        commits.push({ at: performance.now(), durationMs, rendered });
      } catch {
        // Never throw into React's commit phase.
        api.sawCommit = true;
      }
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
  };

  Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
    value: hook,
    configurable: false,
    enumerable: false,
    writable: false,
  });
}

/** Installs the collector on an Electron BrowserContext, before the window's first navigation. */
export async function installCollector(context) {
  await context.addInitScript(collectorInitScript);
}

export async function readCollectorApi(page) {
  return page.evaluate(() => {
    const api = window.__BFC_RENDER_COUNT__;
    if (!api) throw new Error('__BFC_RENDER_COUNT__ missing — collector init script did not run');
    return {
      commits: api.commits,
      marks: api.marks,
      hookInstalled: api.hookInstalled,
      sawCommit: api.sawCommit,
    };
  });
}

/** True when a key looks like a real component name, not a minified single/double-letter one. */
export function looksUnminified(key) {
  if (key === '<anonymous>') return true;
  if (/^[a-zA-Z]$/.test(key)) return false;
  if (/^[a-zA-Z]{2}$/.test(key) && key !== 'h2' && key !== 'h3') return false;
  return /[A-Z]/.test(key) || key.includes('(') || key.length >= 4;
}
