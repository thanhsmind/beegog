---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: standard
---

# post-advisor-hardening — Plan

Source of truth: `docs/history/post-advisor-hardening/CONTEXT.md` (H1–H3).

## Mode Gate

**1 risk flag → `standard`** (3 independent cells across hooks/CLI/tests = story-sized, multi-domain; the flag is *existing covered behavior* — every touched surface has a green suite). No hard-gate flags: H1 is test-only, H2 is an advisory warning, H3 is message prose. `small` rejected only because the slice spans three domains with three workers.

## Discovery — L0

All three items are specified verbatim in the parent feature's learnings/friction (cited in CONTEXT). Sites verified this session: `handleCellsAdd` at `templates/bee.mjs:590` (+`cells.add` map :2381); gate-bypass net instruction text in `hooks/bee-session-close.mjs` (~:211+); onboarding generator inventories mapped 2026-07-17 (vendored list ~:122, settings template ~:1543, codex template ~:1639 in `onboard_bee.mjs`); catalog + `ALLOWED_DIFFERENCES` in `hooks/catalog.mjs`.

## Cells (one slice)

| Cell | Lane | Files bounded to | Verify |
|---|---|---|---|
| `pah-1` (H1) | standard | `skills/bee-hive/scripts/test_onboard_bee.mjs` + `.claude`/`.agents` mirrors, release manifest | `node skills/bee-hive/scripts/test_onboard_bee.mjs && node scripts/release_manifest.mjs --check` — drift row: catalog hook sets (minus ALLOWED_DIFFERENCES, per runtime) ⊆ each generator inventory; prove falsifiability once (temporarily drop a hook from a generator copy in the fixture → RED, restore) |
| `pah-2` (H2) | standard | `skills/bee-hive/templates/bee.mjs` + `.bee/bin/bee.mjs`, `skills/bee-hive/templates/tests/test_bee_cli.mjs` + mirrors, release manifest | `node skills/bee-hive/templates/tests/test_bee_cli.mjs && node scripts/test_lib_mirror.mjs && node scripts/release_manifest.mjs --check` — warning fires on the trap shape, silent when the manifest is listed or verify doesn't mention it; add+update both covered; warning never blocks the write |
| `pah-3` (H3) | standard | `hooks/bee-session-close.mjs`, `.bee/bin/hooks/bee-session-close.mjs`, `hooks/test_hook_contracts.mjs`, release manifest | `node hooks/test_hook_contracts.mjs && node scripts/release_manifest.mjs --check` — the bypass-net instruction for the execution gate names the consult prerequisite for high-risk; existing net/loop-guard rows regress green |

Manifest overlap serializes the three into sequential waves (schedule-computed). Every cell: manifest regen only via `release_manifest.mjs --write` as the final step; mirrors byte-identical; test files touched are declared up front (Addendum 3 discipline).

## Test Matrix (scaled)

Malformed input: H2 lint on cells with missing/odd `verify`/`files` shapes (never throws). Fail-open masking: H1 must be proven falsifiable once (RED then restore). Removal census: H3 keeps every existing B15 keep-intact row green.
