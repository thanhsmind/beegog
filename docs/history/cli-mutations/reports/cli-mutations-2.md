# cli-mutations-2 — bee_backlog.mjs add verb, schema-validated backlog append

**Status:** [DONE]

**Outcome:** Added an `add` verb to `skills/bee-hive/templates/bee_backlog.mjs`
that validates `--type` against `KIND_ALIASES`/`NORMALIZED_KINDS` (imported
from `lib/feedback.mjs`, never a duplicated literal list), `--severity`
(P1|P2|P3), `--layer` (free non-empty string <=40 chars, no allowlist), and
`--title` (<=200 chars), then appends `{ts, type, title, detail, severity,
layer, feature}` (no `source` field) to `.bee/backlog.jsonl` — rejection
leaves the file untouched. Vendored byte-identical to `.bee/bin/bee_backlog.mjs`.
7 new CLI-entry tests added to `templates/tests/test_lib.mjs`. Full suite:
143 passed / 0 failed. No deviations.

**Files touched:**
- `skills/bee-hive/templates/bee_backlog.mjs`
- `.bee/bin/bee_backlog.mjs` (vendor copy)
- `skills/bee-hive/templates/tests/test_lib.mjs`

Full trace/evidence: `.bee/cells/cli-mutations-2.json`
