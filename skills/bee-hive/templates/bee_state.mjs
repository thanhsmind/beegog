#!/usr/bin/env node
// bee_state.mjs — thin shim over the unified dispatcher (dispatcher-unify DB2).
// Every verb (set, gate, worker add/update/remove/clear/prune, scribing-run,
// start-feature) is implemented once in bee.mjs's command registry + handlers;
// this file only prepends the "state" group token and delegates, so
// `bee_state.mjs <verb> ...` stays byte-identical to `bee.mjs state <verb> ...`.
// The observable contract (argv shapes, stdout/stderr text, exit codes) is
// pinned by tests/test_lib.mjs's bee_state checks.

import { main } from './bee.mjs';

process.exitCode = main(['state', ...process.argv.slice(2)]);
