#!/usr/bin/env node
// bee_reservations.mjs — thin shim over the unified dispatcher (dispatcher-unify DB2).
// Every verb (reserve, release, list, sweep) is implemented once in bee.mjs's
// command registry + handlers; this file only prepends the "reservations"
// group token and delegates, so `bee_reservations.mjs <verb> ...` stays
// byte-identical to `bee.mjs reservations <verb> ...`. The observable contract
// (argv shapes, stdout/stderr text, exit codes) is pinned by tests/test_lib.mjs's
// and tests/test_bee_cli.mjs's bee_reservations checks.

import { main } from './bee.mjs';

process.exitCode = main(['reservations', ...process.argv.slice(2)]);
