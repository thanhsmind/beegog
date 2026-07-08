# Worker Report — harness10-4

**Status:** [DONE]
**Worker:** forager-4
**Cell:** harness10-4 — Onboarding audits AGENTS.md outside BEE markers and proposes a minimal header (D4, lane small, behavior_change)
**Commit:** 3e81ecf `harness10-4: onboarding audits AGENTS.md outside BEE markers, proposes minimal header (D4)`
**Reservations:** released (2/2)

## Files changed

- `skills/bee-hive/scripts/onboard_bee.mjs`
- `skills/bee-hive/scripts/test_onboard_bee.mjs`

## What shipped

- `hasProseOutsideBlock(text)` — slices the BEE:START/END block out, strips closed HTML comments (multi-line aware), then tests for any non-empty line. Whitespace-only and comment-only lines never count as prose; an unclosed comment is left in place and counts as prose (conservative: never propose over content).
- `composeAgentsHeader(repoRoot)` — mechanically provable parts only: `# <repo folder name>` title, the loud gap line `<!-- [unknown] one-line project description - replace me -->`, and pointer lines (`- <path>`) only for `README.md` / `docs/specs/system-overview.md` / `docs/specs/reading-map.md` that exist at plan time. Never invents prose (D4).
- `computePlan` step 1b — pushes `{action: "propose_agents_header", path: "AGENTS.md"}` when no prose exists outside the markers. Fresh repos plan `create_agents_block` then `propose_agents_header` (ordered). Existing prose suppresses the item entirely.
- `applyPlan` — header composed once BEFORE any `mergeAgentsContent` call and passed as (a prefix of) the existing-content input of the same merge: block-action case takes `headerText + existing`; a propose-only item (block present and current) runs the same merge, whose in-place block replace preserves everything outside the markers. No second write mechanism, no new merge-helper parameter, `mergeAgentsContent` untouched.
- Idempotency is inherent: the applied title line is prose, so the item never fires again; second apply is byte-identical. Tamper-recovery and preservation semantics unchanged.
- Intended flip asserted: a block-only (pre-header, already-onboarded) AGENTS.md goes `up_to_date -> changes_needed` with exactly `[propose_agents_header]` — propose-only upgrade per D4, consent mechanics unchanged.

## Verify

Command (recorded on the cell with full output):

```
node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs
```

Output tail:

```
ok    - --claude-md appends the import to existing CLAUDE.md
ok    - no duplicate @AGENTS.md import

PASS - failures: 0, skipped: 0
```

(lib: `47 passed, 0 failed`; onboard: 96 ok, 0 failures, 0 skipped — all pre-existing preservation/idempotency/tamper assertions green.)

Red evidence: with the new tests in place and `onboard_bee.mjs` reverted to HEAD, the run fails `FAIL - failures: 7` (plan-shape, header content, pointer lines, block-only flip). Implementation restored, rerun green.

## New test coverage (17 checks)

- empty-repo plan has both `create_agents_block` and `propose_agents_header`, propose ordered after create
- applied header: repo-folder title at top, `[unknown]` gap line present, no pointers for missing files, re-apply byte-identical
- prose outside markers: no propose item, prose preserved byte-for-byte, no header injected
- pointers only for existing files (README.md + reading-map.md present, system-overview.md absent)
- block-only AGENTS.md: flips to changes_needed with only the propose item, header prepended, multi-line comment outside markers preserved (comments are not prose), settles back to up_to_date

## Deviations

None. COMMAND_KEYS duplicate and its drift test untouched; BEE block content and marker handling untouched; no packages installed.

## Outstanding questions

None.
