#!/usr/bin/env node
// bee_capture.mjs — thin shim over the unified dispatcher (dispatcher-unify DB2).
// Every verb (add, list, flush, count) is implemented once in bee.mjs's
// command registry + handlers; this file only prepends the "capture" group
// token and delegates, so `bee_capture.mjs <verb> ...` stays byte-identical
// to `bee.mjs capture <verb> ...`. The observable contract (argv shapes,
// stdout/stderr text, exit codes) is pinned by tests/test_lib.mjs's
// capture-queue checks.

import { main } from './bee.mjs';

process.exitCode = main(['capture', ...process.argv.slice(2)]);
