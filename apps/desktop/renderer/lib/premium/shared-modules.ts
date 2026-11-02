import * as React from 'react';
import * as ReactCompilerRuntime from 'react/compiler-runtime';
import * as ReactJsxRuntime from 'react/jsx-runtime';
import * as ReactDom from 'react-dom';
import * as BombfarmUi from '@bombfarm/ui';
import type { PREMIUM_SHARED_MODULES } from '@bombfarm/contracts';

/** The name a bundle's shims read the live modules from. */
const TABLE_GLOBAL = '__bfcPremiumShared';

type SharedModuleName = (typeof PREMIUM_SHARED_MODULES)[number];

/** The live modules a Premium bundle's UI imports from the app, by module name. */
export const SHARED_MODULES: Readonly<Record<SharedModuleName, object>> = Object.freeze({
  react: React,
  'react/jsx-runtime': ReactJsxRuntime,
  'react-dom': ReactDom,
  'react/compiler-runtime': ReactCompilerRuntime,
  '@bombfarm/ui': BombfarmUi,
});

/**
 * Publishes the table once, frozen and unwritable, so a bundle's UI shares the app's own React
 * instead of loading a second copy. Later calls change nothing.
 */
export function installSharedModules(target: object = globalThis): void {
  if (Object.prototype.hasOwnProperty.call(target, TABLE_GLOBAL)) return;
  Object.defineProperty(target, TABLE_GLOBAL, {
    value: SHARED_MODULES,
    writable: false,
    configurable: false,
    enumerable: false,
  });
}
