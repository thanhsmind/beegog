---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: standard
---

# cli-mutations — every .bee state mutation through one CLI call

**Origin:** bee-evolving Gate A pick (human, 2026-07-11). Backlog: «Internal .bee
mutations still done via Read+Edit/sed — CLI-ify all state mutations» (P2, source human).

**Goal:** agents never hand-edit `.bee/*.json(l)`. One Bash call per mutation —
no Read-before-Edit, no output-token string matching, no schema drift.

## Discovery (L1 — local audit, evidence inline)

Verb inventory (run 2026-07-11):

| Store | CLI | Mutating verbs | Gap |
|---|---|---|---|
| `.bee/cells/` | bee_cells | add, claim, verify, cap, block, drop, tier, judge | none |
| `.bee/decisions.jsonl` | bee_decisions | log, supersede, redact | none |
| `.bee/reservations.json` | bee_reservations | reserve, release, sweep | none |
| capture-queue | bee_capture | add, flush | none |
| `.bee/state.json` | — | **none** | **entire file hand-edited** |
| `.bee/backlog.jsonl` | bee_backlog | none (counts/rank/badges read-only) | **appends hand-written** |

Hand-edit instructions in skill prose: bee-exploring:71, bee-planning:96,
bee-swarming:41+71, bee-scribing:112, bee-reviewing:98+105, bee-bypass-gate:24
(gate approvals) — all say "update/record in `.bee/state.json`".

Live cost evidence: 19 backlog lines appended by hand with `kind:` instead of
`type:` since 2026-07-10 → dropped as `unknown_type`, invisible to
bee-evolving until found by accident today. A validating `add` verb makes this
class impossible.

Source of truth: `skills/bee-hive/templates/*.mjs`, vendored to `.bee/bin/` by
`onboard_bee.mjs` `copy_helper` (iterates all `templates/*.mjs` — a new helper
is picked up with no onboarding change). Tests: `templates/tests/test_lib.mjs`.

## Mode gate

Flags counted: data model (internal state schema), existing covered behavior
(test_lib.mjs covers lib helpers the CLIs share) = **2 → standard**.
Not small: 3 surfaces (new CLI, extended CLI, prose sweep across 6+ skills)
exceed the ≤3-file honesty bar and touch every future session's behavior.

## Approach

Chosen: extend the existing thin-CLI pattern (bee_cells shape: verbs + flags,
atomic writes via lib, ERROR/WHY/FIX denials per decision 48ac3323) — no new
framework, no SQLite (rejected earlier today: does not reduce tool calls,
loses git-diffability at gates).

1. **`bee_state.mjs` (new template + vendored copy).** Verbs:
   - `set --phase <p> [--mode m] [--feature f] [--next-action s] [--summary s]`
   - `gate --name context|shape|execution|review --approved true|false`
   - `worker add|update|remove|clear [--nickname n --cell id --tier t --status s]`
   - `scribing-run --feature f --areas a,b` (stamps ISO `at`, decision 0011)
   Enum-validated phase/gate names; unknown flag = ERROR/WHY/FIX; atomic write;
   read path stays `bee_status`.
2. **`bee_backlog.mjs add`.** Flags `--type --title --severity --layer
   --detail --feature`; `type` must be a KIND_ALIASES key (rejects `kind:`
   drift at the door), severity P1–P3, layer from the fixed taxonomy, title ≤200.
3. **Prose sweep (grep-driven, not a fixed list).** `state.json` mutation
   instructions appear in 10 SKILL.md files plus `templates/AGENTS.block.md`
   (advisor consult) — sweep by grep, replace each with the exact CLI call;
   one standing rule added to bee-hive SKILL.md: "Never hand-edit
   `.bee/*.json(l)`. A mutation with no CLI verb is filed as friction, then
   (only then) edited by hand." Compounding/grooming append templates →
   `bee_backlog.mjs add`.
4. **Mechanical enforcement.** Extend `bee-write-guard.mjs` (already
   intercepts Edit/Write/MultiEdit) with a deny rule for direct edits to
   `.bee/state.json` and `.bee/backlog.jsonl` once the CLIs exist —
   prose rules decay, hooks don't. Deny message follows ERROR/WHY/FIX and
   names the CLI verb to use instead.

Rejected: single `bee_state set --json '<blob>'` passthrough (no validation —
keeps the schema-drift class alive); patching each skill with inline `node -e`
snippets (scatters unvalidated writers, the exact disease).

Risk map: state.json **lost-update window** — bee-state-sync.mjs hook does a
full read-modify-write on PostToolUse/SubagentStop/Stop, so a stale hook read
can clobber a fresh `gate --approved` write (advisor consult; atomicity does
not cover this) — MEDIUM — proof needed in validating: probe the RMW window,
or scope hook and CLI to merge only their own fields. Hook readers of
state.json expect current field shapes — MEDIUM — proof: grep
`.bee/bin/hooks/*` + `bee_status` for every field the new CLI writes, confirm
names/types unchanged (CLI writes the same schema, only the writer changes).

## Test matrix sketch (12-dimension pass, standard depth)

- happy path per verb; enum rejection (bad phase, bad gate name, bad type/severity/layer)
- missing/corrupt state.json (create-or-fail semantics decided in validating)
- idempotence: `gate --approved true` twice = same file
- worker add→update→remove→clear round-trip preserves unrelated state fields
- backlog add: appended line parses, digest picks it up (not dropped), title >200 rejected
- unknown verb/flag → ERROR/WHY/FIX, exit non-zero, file untouched

## Slice plan (current slice = all four cells; wave 1 = cells 1–2, wave 2 = cells 3–4)

File bounds: cell 1 → `skills/bee-hive/templates/bee_state.mjs` (new),
`templates/tests/test_lib.mjs`, `.bee/bin/bee_state.mjs` (vendor copy);
cell 2 → `templates/bee_backlog.mjs`, `templates/tests/test_lib.mjs`,
`.bee/bin/bee_backlog.mjs`; cell 3 → `skills/*/SKILL.md` grep hits +
`templates/AGENTS.block.md`; cell 4 → `hooks/bee-write-guard.mjs`,
`hooks/test_write_guard.mjs` (new), `.bee/bin/hooks/bee-write-guard.mjs`.
Verification: `node skills/bee-hive/templates/tests/test_lib.mjs` (cells 1–2),
grep assertions (cell 3), hook fixture test (cell 4).

1. `cli-mutations-1`: bee_state.mjs template + tests + vendor copy
2. `cli-mutations-2`: bee_backlog.mjs add verb + tests + vendor copy
3. `cli-mutations-3`: prose sweep (grep-driven: all SKILL.md hits + AGENTS.block.md + bee-hive rule + compounding/grooming templates)
4. `cli-mutations-4`: bee-write-guard deny rule for direct `.bee/state.json` / `.bee/backlog.jsonl` edits + tests

Cells 1–2 independent; cells 3–4 depend on both (cite final verb/flag names).

## Open questions for validating

- Does any hook (`.bee/bin/hooks/*`) write state.json fields the new CLI must
  not fight over (e.g. state-sync hook)? Probe the RMW lost-update window.
- `scribing-run` field set: exact keys bee-scribing:112 requires.
- Should `worker` verbs also sweep reservations (no — bee_reservations owns
  that; confirm no overlap).
- `bee_backlog add --type`: accept alias keys only, or also already-normalized
  values (digest merge path accepts both — KIND_ALIASES lib/feedback.mjs:67)?
- Write-guard deny scope: exact match list vs `.bee/*.json(l)` glob — must not
  block the CLIs' own writes (hooks see tool calls, not child processes — confirm).

## Advisor consult (shape) — decision 0013

Verdict: **APPROVE-WITH-NOTES** (fable, 2026-07-11). Notes folded in: grep-driven
sweep incl. AGENTS.block.md; lost-update RMW hazard relabeled MEDIUM; write-guard
mechanical enforcement added as cell 4; --type dual-vocabulary question added.
