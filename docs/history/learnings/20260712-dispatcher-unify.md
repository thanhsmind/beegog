# Learnings — dispatcher-unify (2026-07-12)

Feature: all 9 bee helper groups unified into `bee.mjs` (registry + handlers);
every `bee_*.mjs` reduced to a 2-line shim. 6 cells, final battery
220/102/19 passed, 0 failed; onboard 0 failures. Head `89999c5`.

## Durable patterns

1. **Handler-owned validation for stderr parity (DB3 discipline).** The dispatcher's
   generic `validate()`/`parseFlags` errors go to stdout; every legacy pinned suite
   expects refusals on stderr. Rule for every future verb: registry entry declares
   `required: []`, the handler throws the exact legacy text (throw → emitError → stderr).
   Documented in command-registry.mjs's header.

2. **`FLAG_ALONE_BOOLEANS` is a live registry, not a closed set.** Any boolean flag that
   appears without a value (`--dry-run`, `--write`, `--stdin`, ...) MUST be in that set or
   generic parsing eats the next token as its value (`--dry-run --json` consumed `--json`).
   Bit du-1 and du-2 independently.

3. **Test fixtures with explicit vendored-module lists break on transitive imports.**
   test_bee_write_guard_hook's fixture vendors a fixed lib list; du-3 adding
   `command-registry.mjs → reviews.mjs → cells.mjs` imports made the registry import
   throw *inside the fixture only*, failing the hook open (2 denial tests silently
   inverted). When adding imports to any module a fixture vendors, chase the transitive
   closure into the fixture list.

4. **Verify a worker's red-cause diagnosis before building on it.** du-3 attributed the
   red hook suite to "concurrent du-6 work" — du-6 was already capped; the true cause was
   du-3's own registry import (item 3). The orchestrator reproducing the failure directly
   (run the suite, diff the copies, import the module) found the root cause in three
   commands. A wrong blame line in a worker report is a scheduling hazard: it nearly
   deferred a real regression to a cell that wasn't causing it.

5. **Registry examples are executed contract.** test_bee_cli runs every registry example
   for real; new groups need fixture repos seeded so examples succeed (du-2's flush stub,
   du-3's A10-satisfying capped cell). An example that can't run is a red suite, not
   documentation.
