#!/usr/bin/env node
// bee_decisions.mjs — thin shim over the unified dispatcher (dispatcher-unify DB2).
// Every verb (log, supersede, redact, active, search) is implemented once in
// bee.mjs's command registry + handlers; this file only prepends the
// "decisions" group token and delegates, so `bee_decisions.mjs <verb> ...`
// stays byte-identical to `bee.mjs decisions <verb> ...`. The observable
// contract (argv shapes, stdout/stderr text, exit codes) is pinned by
// tests/test_lib.mjs's and tests/test_bee_cli.mjs's bee_decisions checks.

import { main } from './bee.mjs';

process.exitCode = main(['decisions', ...process.argv.slice(2)]);
