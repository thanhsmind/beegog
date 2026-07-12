#!/usr/bin/env node
// bee_cells.mjs — thin shim over the unified dispatcher (dispatcher-unify DB2).
// Every verb (list, ready, show, add, update, claim, verify, cap, block, drop,
// tier, judge) is implemented once in bee.mjs's command registry + handlers;
// this file only prepends the "cells" group token and delegates, so
// `bee_cells.mjs <verb> ...` stays byte-identical to `bee.mjs cells <verb> ...`.
// The observable contract (argv shapes, stdout/stderr text, exit codes) is
// pinned by tests/test_lib.mjs's and tests/test_bee_cli.mjs's bee_cells checks
// — including the "add --stdin" whole-slice JSON-array batch case.

import { main } from './bee.mjs';

process.exitCode = main(['cells', ...process.argv.slice(2)]);
