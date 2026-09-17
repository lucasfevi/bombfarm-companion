import { spawn } from 'node:child_process';
import process from 'node:process';

/**
 * The child has to go through a shell, because on Windows `pnpm` is a `.cmd` shim that
 * `CreateProcess` cannot exec directly. Passing an args array alongside `shell` concatenates it
 * unescaped — that is Node's DEP0190 warning, and it really does mangle arguments (`node -e
 * "a b"` arrived as `bad option: -,`). So the command line is built here instead, and anything
 * that would need quoting to survive the trip is refused rather than silently corrupted.
 *
 * Every call site passes bare tokens (`pnpm -r build`, `vitest run`), so this rejects nothing in
 * practice — it is here so that a later call site with a quoted argument fails loudly at the
 * first run instead of running something subtly different from what it reads like.
 */
const SHELL_SAFE_TOKEN = /^[A-Za-z0-9._@:=/\\-]+$/;

/** @param {string[]} argv @param {string} wrapperName printed in the usage and refusal lines */
export function bareTokensOrExit(argv, wrapperName) {
  if (argv.length === 0) {
    process.stderr.write(`usage: node tools/${wrapperName}.mjs <command> [args...]\n`);
    process.exit(2);
  }
  const unsafe = argv.filter((token) => !SHELL_SAFE_TOKEN.test(token));
  if (unsafe.length > 0) {
    process.stderr.write(
      `${wrapperName}: refusing to shell-quote ${JSON.stringify(unsafe)}. ` +
        'Pass bare tokens, or run the command directly.\n',
    );
    process.exit(2);
  }
  return argv;
}

/** Run the tokens as one shell command line, passing its exit through — signal deaths included. */
export function runBareTokens(argv) {
  const child = spawn(argv.join(' '), { stdio: 'inherit', shell: true });

  child.on('error', (error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    // Signal deaths must stay signal deaths, or Ctrl-C reads to the caller as a plain failure.
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}
