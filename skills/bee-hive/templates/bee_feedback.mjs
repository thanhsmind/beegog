#!/usr/bin/env node
// bee_feedback.mjs — thin shim over the unified dispatcher (dispatcher-unify DB2).
// Every verb (digest, count, collect, rank) is implemented once in bee.mjs's
// command registry + handlers; this file only prepends the "feedback" group
// token and delegates, so `bee_feedback.mjs <verb> ...` stays byte-identical
// to `bee.mjs feedback <verb> ...`. The observable contract (argv shapes,
// stdout/stderr text, exit codes) is pinned by tests/test_lib.mjs's
// bee_feedback checks.

import { main } from './bee.mjs';

process.exitCode = main(['feedback', ...process.argv.slice(2)]);
