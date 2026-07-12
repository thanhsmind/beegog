---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: standard
---

# bee-footprint — contain bee's file footprint in host repos

## Origin

Real host-user feedback (2026-07-12), filed as backlog P2 friction + 2 P3 items:

1. **Noise:** `.bee/*.json` churn shows up continuously in the user's git status / IDE while they work — onboarding never manages `.gitignore` (grep-verified: zero gitignore handling in `skills/bee-hive/`).
2. **Scatter:** `.spikes/` lives at repo root, outside `.bee/` — the user expects everything bee creates contained in bee's own box.
3. **Found while diagnosing:** the bee repo's own `.gitignore` is corrupt — two entries merged into one line (`.bee/feedback-digest.json.spikes/`, missing newline), so neither works; `feedback-digest.json` and 187 `.spikes/` files are git-tracked.

Locked decisions: D1 (managed gitignore block, durable-vs-local classification), D2 (spikes → `.bee/spikes/`, allowlist shrink), D3 (bee repo self-migration + untracking). IDs 26203bd3 / 8ed35504 / 72855a0e, 2026-07-12.

## Mode Gate

Flags counted: **cross-platform** (onboard runs on Windows Git Bash — critical-patterns 20260708), **existing covered behavior** (onboard + guards are heavily test-covered; byte-identity twin tests), **audit/security-adjacent** (GATE_ALLOWED_PREFIXES edit — but strictly tightening: one root-level allowlisted prefix removed, `.bee/` already covers the new home; hooks are documented as not a security boundary). = **3 flags → standard.** Not high-risk: no hard-gate flag — no auth, no data loss (`git rm --cached` preserves working tree; git history preserves blobs), no validation removal (allowlist shrinks, never widens).

## Discovery (L1 — findings inline, per decision 0009)

- **Onboard architecture** (sonnet miner digest): `computePlan` builds the plan in numbered stages (`onboard_bee.mjs:1107-1238`); `applyPlan` is a `switch(item.action)` loop (`:1334-1447`); recheck = `computePlan` re-run post-apply (`:1643`) — a new stage that is a pure function of on-disk state gets recheck and `--json` reporting for free. Marker-splice precedent exists: `mergeAgentsContent` (`:915-932`) replaces only between `BEE:START/END`, tamper-tested at `test_onboard_bee.mjs:292-319`. Test fixtures: `mkdtempSync` + `makeFakeHome()` + `runOnboard()` helpers reused verbatim.
- **Marker syntax constraint:** `.gitignore` comments are `#` lines — the block markers must be `# BEE:START` / `# BEE:END` (an HTML comment would be parsed as an ignore pattern).
- **`.spikes` reference inventory** (haiku miner + session grep — haiku under-reported `.md` hits; combined list is authoritative):
  - Code: `skills/bee-hive/templates/lib/guards.mjs:31` (`GATE_ALLOWED_PREFIXES`) + `.bee/bin/lib` twin; `hooks/bee-session-close.mjs:24` + `.bee/bin/hooks/bee-session-close.mjs:69` (`NUDGE_ALLOWED`) — check for a templates/hooks twin during execution; twins must stay byte-identical (test_lib enforces).
  - Living docs: `skills/bee-validating/SKILL.md:47,52`; `skills/bee-validating/references/validation-reference.md:41,46`; `skills/bee-planning/references/planning-reference.md:93`; `skills/bee-exploring/SKILL.md:21,57,87,88`; `skills/bee-hive/SKILL.md:116`; `skills/bee-hive/references/routing-and-contracts.md:90,104,219`; `skills/bee-hive/templates/AGENTS.block.md:67`.
  - Archives (never rewritten, per D2): `docs/history/`, `.bee/decisions.jsonl`, `.bee/cells/codex-parity-*.json`.
- **Tracked-file classes in this repo** (haiku miner §3-4): mutable-tracked = `state.json`, `reservations.json`, `capture-queue.jsonl`, `feedback-digest.json`, `workers/` (8), `logs/` (2); spikes tracked = 187 files under `codex-runtime-parity/` + `fanout-delegation/`.

## Approach

One slice, three cells, dependency-ordered (verification folds into each cell's verify command + the review gate — a standalone verify cell is ceremony):

1. **footprint-1 — onboard gitignore stage** (behavior_change): new `computePlan` stage emitting `create_gitignore_block | append_gitignore_block | update_gitignore_block` for a `# BEE:START…# BEE:END` block (D1 file list); `applyPlan` case arms via `writeFileAtomic`; `gitignore_block` sha256 in managed versions; tests per the propose-agents-header idiom incl. tamper/idempotency round.
2. **footprint-2 — spikes containment** (behavior_change): `.spikes/<feature>/` → `.bee/spikes/<feature>/` across the living docs listed above; remove `.spikes/` from `GATE_ALLOWED_PREFIXES` and `NUDGE_ALLOWED` in ALL copies (templates + `.bee/bin` twins + plugin `hooks/` copy); test_lib assertions updated if any pin the old prefix.
3. **footprint-3 — bee repo self-migration** (depends 1,2): move `.spikes/*` → `.bee/spikes/`; `git rm --cached` the D3 file list; run `onboard --apply` so the managed gitignore block + synced twins land; delete the corrupt hand-written lines. Verify includes fresh `git status` proof that mutable churn is gone.

Post-Gate-4 (outside cells): version bump → tag v0.1.24 → push --tags → onboard anphabe hosts (trừ anphabe-crm), per the standing release flow.

**Risk map:** onboard stage = MEDIUM (new write surface in host repos — proof: tamper/idempotency tests + recheck up_to_date) · allowlist edit = LOW (strict shrink; twin byte-identity enforced by test_lib) · untracking = LOW (working tree + git history preserve everything) · Windows = LOW (plain text file writes through existing `writeFileAtomic`).

**Rejected alternatives:** (a) gitignore-only for `.spikes/` at root (cheaper but leaves the scatter the user explicitly objected to); (b) ignoring all of `.bee/` (throws away team-durable knowledge: decisions, backlog, cells, vendored bin); (c) rewriting archived docs/decisions that mention `.spikes` (history is immutable).

**Open questions for validating:** does any test in `test_lib.mjs` or fixture pin the literal `.spikes/` prefix? Does the plugin-root `hooks/` copy of `bee-session-close.mjs` have a vendored-twin sync path, or is it hand-maintained (partial-sync P3 already on backlog)? Does `bee_status`/preamble anywhere print `.spikes` paths?

## Test matrix sketch (edge dimensions that bite here)

- **Idempotency:** second `onboard --apply` on an already-blocked `.gitignore` = byte-identical file, `recheck: up_to_date`.
- **Boundary/tamper:** user content before AND after the block survives byte-for-byte; hand-tampered block content is restored; a `.gitignore` with no trailing newline doesn't corrupt (the original bug class!).
- **Absence:** repo with no `.gitignore` → `create_gitignore_block`; repo with `.gitignore` but no markers → `append_gitignore_block`.
- **Cross-platform:** paths written with forward slashes (gitignore syntax is slash-normalized; no `path.sep` leakage).
- **Twin drift:** templates ↔ `.bee/bin` byte-identity test stays green after the guards/hook edits.
