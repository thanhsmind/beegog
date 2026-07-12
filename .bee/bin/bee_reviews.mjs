#!/usr/bin/env node
// bee_reviews.mjs — thin shim over the unified dispatcher (dispatcher-unify DB2).
// Every verb (create, list, show, record, candidate add, candidates, status)
// is implemented once in bee.mjs's command registry + handlers; this file
// only prepends the "reviews" group token and delegates, so
// `bee_reviews.mjs <verb> ...` stays byte-identical to
// `bee.mjs reviews <verb> ...`. The observable contract (argv shapes,
// stdout/stderr text, exit codes) is pinned by tests/test_lib.mjs's
// bee_reviews checks.

import { main } from './bee.mjs';

process.exitCode = main(['reviews', ...process.argv.slice(2)]);
