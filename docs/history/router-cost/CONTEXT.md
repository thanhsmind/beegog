# router-cost — locked decisions

**Feature:** cut the cost a cold route pays before it can make a single decision.
**Lane:** standard (flags: public contracts, cross-platform, multi-domain — no hard-gate flag).
**Origin:** a user-reported 5m52s turn that produced no visible progress. Diagnosis in the session
that opened this feature: ~50-60k tokens of dense instruction prose reconciled before one routing
decision, plus a 1601-line file read inline on the session model after a gather worker had already
run.

## The measured problem

| Source loaded on a cold route | Size |
|---|---|
| `AGENTS.md` (auto-loaded every session) | 19 KB |
| SessionStart preamble (patterns digest + decisions) | ~8 KB |
| `skills/bee-hive/SKILL.md` | 34 KB |
| `skills/bee-planning/SKILL.md` | 21 KB |
| `references/routing-and-contracts.md` | 34 KB |
| a 1601-line source file, read inline | ~15 KB |

Two distinct costs, often conflated:

1. **Bytes loaded before the lane is known.** The lane decision happens *after* `bee-hive` and
   `bee-planning` are both in context. A `tiny` task pays a `standard` entry fee.
2. **Bytes the orchestrator reads that a worker should have read.** Critical rule 13 exists and was
   partially honoured in the reported turn — a `bee-gather` ran — and then the session model read a
   1601-line file inline anyway. The rule held for the search and failed for the read.

## Locked decisions

### D1 — The large-read guard is a denial, not a nudge

`PreToolUse` has no "warn without blocking" verdict. The advisory encoding in `hooks/adapter.mjs`
(`encodeAdvisory`, `ADVISORY_EVENTS`) is reserved for `PreCompact | SubagentStop | Stop`, because on
those events a plain `decision:"block"` would wrongly continue or loop a turn. On `PreToolUse` only
two verdicts reach the model: exit 2 (deny, stderr fed back) and exit 0 (allow).

Therefore the guard **denies**, with the fix named in the denial message. A soft nudge was considered
and rejected: rule 13 is already a soft nudge, and the reported turn is the evidence that a soft
nudge does not hold under context pressure.

### D2 — Threshold is 800 lines, derived by measurement

Measured over 2092 tracked `.mjs/.js/.json/.md` files:

| Threshold | Files at or above | Share |
|---|---|---|
| 2000 | 51 | 2.4% |
| 1500 | 83 | 4.0% |
| 1000 | 114 | 5.4% |
| **800** | **153** | **7.3%** |
| 500 | 231 | 11.0% |

800 trips on roughly one file in fourteen while covering the files that actually blow a context
window. The number is recorded as a measurement, not a preference, and lives in `.bee/config.json`
so a host repo can move it without editing the hook.

### D3 — Extend the existing read branch; do not add a hook

The `PreToolUse` matcher already covers `Read`, and `hooks/bee-write-guard.mjs` already has a
`READ_TOOLS` branch (`guards.checkRead`) for privacy and scout-directory denials. The size check
joins that branch.

Consequence: no `hooks/catalog.mjs` entry, no regeneration of `hooks/hooks.json`,
`hooks/claude-hooks.json`, or `.codex/hooks.json`, and no new `.bee/config.json` hook toggle — the
existing `hooks.write-guard` toggle covers it.

### D4 — Escape hatches are explicit and named in the denial

The guard allows the read when `offset` or `limit` is set: reading a slice is the correct way to read
a large file, and must never be blocked. The denial names both routes — pass `limit`, or dispatch a
`bee-extract` worker for the whole file — so the message teaches the fix rather than only refusing.

### D5 — The reachability guard lands before the router is cut

`rc-2` (pointer integrity) precedes `rc-4` (slim the router). Moving prose into a reference doc is
exactly the migration whose instruction layer rots silently
(`20260722-a-migration-is-not-done-until-its-instructions-are`): guards protect content, nothing
tests prose. Cutting first and guarding later would be cutting without a net.

### D6 — The ten verbatim pins are preserved character-for-character

`skills/bee-hive/SKILL.md` carries exactly ten string pins, all inside the Modes & Lanes region:

REQUIRED: `changes behavior an existing test asserts` · `weakening, deleting, or replacing existing
proof` · `product files only` · `cell is the micro-plan` · `plan.md is opt-in` · `logged scoping
synthesis` · `dispatched execution worker`

BANNED: `existing covered behavior` · `weak proof around the area` · `| direct, in-session (solo) |`

Enforced at `scripts/test_gate_bypass_doctrine.mjs:137-200` and
`skills/bee-hive/templates/tests/test_misc.mjs:1839-1844`. Several are cross-file consistency pins
also required in `README.md` and `skills/bee-hive/templates/AGENTS.block.md`; rewording one would
require rewording all. The slim therefore touches only unpinned sections, and the pinned region is
left alone.

### D7 — Early triage saves the second skill load, not the first

Skills load whole-file: invoking `Skill(bee-hive)` puts all of `SKILL.md` in context regardless of
what the first lines say. A triage block therefore cannot reduce what `bee-hive` itself costs.

What it does reduce is the *second* load. In the reported turn both `bee-hive` and `bee-planning`
were loaded before the lane was known. The two levers are independent and additive:

| Lever | Saves | When |
|---|---|---|
| `rc-3` early triage | ~5.3k tokens (`bee-planning` never loaded) | tiny / small / docs routes |
| `rc-4` slim router | ~5k tokens | every route |

### D8 — Cells run serially, and each carries its own regen obligation

All four cells touch shared surfaces (`skills/**`, `hooks/**`). They run one at a time. This follows
the previous feature's D21: serial scheduling removes the cross-cell write hazard at its source
rather than managing it with reservations.

Every cell touching `skills/**` or `hooks/**` carries `scripts/release_manifest.mjs --write` and
`--check` in its own verify, and lists the manifest path in its own files. `release_manifest.mjs`
hashes `skills/**` and `hooks/**` in full (`release_manifest.mjs:131,133`); `ledger_parity.mjs`
covers only `.bee/bin/lib` and is not moved by this feature.

This is backlog item P75's rule, applied by hand because P75 itself is not built. P75 is the
mechanization that would derive this obligation from a cell's declared `files` at authoring time; it
was named during the previous feature as the thing that "would have caught both failed shape
reviews" and was filed rather than built. Applying it manually here is a deliberate stopgap, not a
substitute.

### D9 — This feature runs in a worktree

A second live session (`bf74e71a`) held the main checkout when this feature started, and that same
session destroyed a cell's uncommitted work twice earlier the same day via force-unclaim plus a
merge. Per AGENTS.md critical rule 14, new feature work in an occupied checkout takes
`bee worktree new`. Merge back through `bee worktree merge --id beegog--wt--router-cost`, whose
staged-verify step is the semantic-conflict gate.

### D10 — What rc-1 actually buys, corrected at implementation time

Two facts surfaced while capping rc-1 that were not known when D1-D4 were locked. Both narrow the
guard's claimed value, and both are recorded here rather than left in a chat log.

**The harness already truncates a very large Read.** Reading the 5557-line
`skills/bee-hive/templates/bee.mjs` with no `limit` returned lines 1-1122 and stopped at a 25000-token
cap, with an explicit pagination instruction and the warning "Do NOT answer from this page alone".
So the original framing — "an unbounded Read blows the context window" — is only true below that cap.
Above it, the harness already protects the window.

The guard's real value is therefore **not** context protection at the top end. It is:

1. The 800-to-~1100-line band, where a file is big enough to dominate a turn but small enough that
   the harness returns it whole.
2. Converting a *silent partial read* into an explicit instruction. A truncated read leaves the model
   holding an incomplete file that looks complete enough to reason from; the guard's denial names the
   worker route instead. A partial read reasoned over as if whole is a worse failure than a refusal.

This is a smaller claim than D1 implied, and it is the honest one.

**The guard cannot be dogfooded from the session that wrote it.** The hook that actually executes is
resolved from the harness's project directory — the MAIN checkout's
`.bee/bin/hooks/bee-write-guard.mjs`, which does not carry this change and will not until the
worktree merges. Confirmed by measurement: `grep -c "read-size guard"` returns 1 in the worktree's
mirror and 0 in main's. Every claim about this guard's live behaviour therefore rests on
`hooks/test_write_guard.mjs`, not on observing it fire in this session. Do not let a later session
mistake "I did not see it block me" for "it does not work".

## Outstanding questions

- Whether 800 is right in a host repo whose file-size distribution differs from bee's own. The
  threshold is configurable specifically because this is unresolved; bee's own distribution is the
  only one measured.
- Whether `rc-4`'s moved prose should land in `routing-and-contracts.md` (already 34 KB, itself a
  large deferred-to file) or in a new, smaller reference. Deferred to `rc-4`'s own shaping, once
  `rc-2` reports how many pointers exist to keep honest.
