#!/usr/bin/env node
// bee_status.mjs — thin shim over the unified dispatcher (dispatcher-unify DB2).
// The read-only status report (onboarding health, phase, gates, handoff, cell
// counts, reservations, decisions, staleness warnings, recommended next step)
// is implemented once in bee.mjs's "status" command + handler; this file only
// prepends the "status" group token and delegates, so `bee_status.mjs [--json]`
// stays byte-identical to `bee.mjs status [--json]`. The observable contract
// (stdout/stderr text, exit codes) is pinned by tests/test_lib.mjs's and
// tests/test_bee_cli.mjs's bee_status checks.

import { main } from './bee.mjs';

process.exitCode = main(['status', ...process.argv.slice(2)]);
