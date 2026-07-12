#!/usr/bin/env node
// bee_backlog.mjs — thin shim over the unified dispatcher (dispatcher-unify DB2).
// Every verb (counts, rank, badges, add) is implemented once in bee.mjs's
// command registry + handlers; this file only prepends the "backlog" group
// token and delegates, so `bee_backlog.mjs <verb> ...` stays byte-identical
// to `bee.mjs backlog <verb> ...`. The observable contract (argv shapes,
// stdout/stderr text, exit codes) is pinned by tests/test_lib.mjs's
// bee_backlog checks.

import { main } from './bee.mjs';

process.exitCode = main(['backlog', ...process.argv.slice(2)]);
