# evolving-5 — [DONE]

**Outcome:** Closed review P1-1. `mergeDigests` now revalidates every foreign field, not just `title`.
Foreign entries route through the shared `buildEntry(neutralize:true)` construction path (the ad-hoc raw
copy loop is deleted): `source`/`layer` are scanned (drop with attributed reason), `kind` re-normalized
through `KIND_ALIASES` (unknown → `unknown_type`), non-strings coerced to null, `title` capped then
datamarked, every surviving string field datamarked, `pain` validated to int-or-null, `first_seen` must
parse. The `dropped[]` leak is closed too: dropped-record `source`/`layer`/`kind` are sanitized —
a field that independently matches a secret/injection pattern is nulled (never records matched text),
a clean field is datamarked (never raw).

**Authorized assertion change:** exactly one (`test_lib.mjs:1833`, per decision `c45d0fb3`) — rewritten
from `entry.source === 'src'` to `entry.source === datamark('src')`, keeping the `pain` check. The other
92 frozen assertions untouched. +7 new reproduction tests appended.

**Red → Green:** before the `feedback.mjs` fix the rewritten 1833 plus all 7 new tests failed
(92 passed, 8 failed), reproducing P1-1. After the fix: `test_lib.mjs` **100 passed, 0 failed**;
`test_onboard_bee.mjs` **PASS, failures 0**; exit 0.

**Files:** `skills/bee-hive/templates/lib/feedback.mjs`, `skills/bee-hive/templates/tests/test_lib.mjs`

Full trace / verification evidence / friction: `.bee/cells/evolving-5.json`.
