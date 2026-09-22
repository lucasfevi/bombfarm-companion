// Vitest's worker reports each task over an RPC with a 60 s reply window, and a file of
// synchronous tests never turns the event loop between them, so the reply is read only when the
// file ends: a file past 60 s in total fails the run with every test passing
// (`[vitest-worker]: Timeout calling "onTaskUpdate"`). One macrotask after each test lets the
// worker read it, so the window applies to a single test body instead of the file.
import { afterEach } from 'vitest';

afterEach(() => new Promise<void>((resolve) => setImmediate(resolve)));
