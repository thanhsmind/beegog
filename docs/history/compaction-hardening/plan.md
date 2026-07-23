---
artifact_contract: bee-plan/v1
mode: high-risk
feature: compaction-hardening
context: docs/history/compaction-hardening/CONTEXT.md
revision: 3
supersedes: revision 1 (failed validation) and revision 2 (failed independent review, 6 CRITICAL)
approved_gate2: 2026-07-23 (auto-approved, gate_bypass=total)
advisor_ref: reports/advisor-digest-gate3.md
cells: cz-1 … cz-8 (the chx-* set of revision 2 is dropped)
---

# Compaction Hardening — Plan (revision 3)

Revision 1 was shaped, frozen, and **failed validation on six blocking findings**.
This revision is not a patch of it — the anchor-ownership decision (D19) changed what
the work is, and three of the six findings were structural to the slice shape. The
full evidence is in `reports/validation-slice1.md`; the corrections are D19-D22 in
`CONTEXT.md`.

## What revision 1 got wrong

| Finding | Correction |
|---|---|
| Four cells would have built on a red baseline: creating `compaction.mjs` turns `release_manifest --check` and `ledger_parity --check` red repo-wide (`run_verify.mjs:56-64`) and no cell's verify covered them. Revision 1 cited PAT37 and then did the exact thing PAT37 condemns, for its **fifth** recurrence. | **D20** — every lib-touching cell runs the regen inside its own work and carries both checks in its own verify. |
| Registering `state compact-capsule` before its builder exists turns the repo red: `test_bee_cli.mjs:2558` asserts every registry entry's example executed, unconditionally. | The verb moves to `chx-5`, the cell that builds it. |
| The capsule cell was `behavior_change` with a verify that passed whether the capsule was correct, empty, or throwing. | `chx-5` authors `scripts/test_compact_capsule.mjs`; every behavior cell now names its red-failure evidence obligation in its own action text. |
| The anchor would have rendered **twice** on `compact` — the hook already prefixes it (`bee-session-init.mjs:44`) and D6 item 1 put it in the capsule too. Neither the anchor-first must-have nor D16's replacement assertion would have caught it. | **D19** — the hook keeps owning the anchor; the capsule is the body only. This retires D16 and its HIGH-rated test surgery entirely. |
| The doctrine gate globbed `AGENTS.block.md`, so it could not see the merged root `AGENTS.md` that D1 names; and its derivation (`Object.keys` on `.codex/hooks.json`) yields `['hooks']`, length 1. | **D22** — assert over the root file too, derive from `Object.keys(json.hooks)`, derive the hook-script count by glob, and prove the gate bites with a `--selftest`. |
| `ch-1` ran `onboard --apply`, writing four other cells' declared files, while scheduled in the same wave as `ch-2`. | **D21** — the slice runs strictly serially; `chx-1` runs first and alone. |

Two further corrections to revision 1's own prose, both measured: full verify wall-time
is **63.6 s**, not the "~30-32 s" it claimed (the comments it copied are stale — 84
suites now); and the `indexOf` risk it rated HIGH was overstated — measured, `n < -1`
is false, so the row fails loudly and cannot silently pass.

## Mode Gate Record

**Honest count is 5 → high-risk is mechanically correct** (D23). Revision 2 argued the
count had fallen to 3 and that the lane was a deliberate over-protection. That was
wrong. D19 does remove the SessionStart test change, but the forced PreCompact nudge
changes the additivity row at `hooks/test_hook_contracts.mjs:2692-2712` — the nudge
fires exactly when no anchor exists, i.e. only in that row's control fixture — so
"changes behavior an existing test asserts" and "requires replacing existing proof" are
both back, and `cz-7` owns the split. The deliberate retention turned out to be right
for a reason revision 2 had not found, which is an argument for holding ceremony when
the count sits at the boundary, not against it.

*Revision 2's superseded reasoning, kept for the record:*

D19 drops two of revision 1's five flags: with the hook keeping the anchor and the
capsule preserving the `- Phase:` label verbatim, **no existing test assertion
changes** — so "changes behavior an existing test asserts" and "requires replacing
existing proof" both evaporate. Remaining: public contracts (three verbs enter the
shipped `bee.mjs --help --json` manifest; the doctrine block renders into every
consumer repo), cross-platform, multi-domain.

The lane is retained because this change sits in the orientation path every session on
both runtimes depends on, and because this slice already failed one validation pass on
six blocking findings. Padding the count to justify the lane would corrupt the mode
gate for every future feature; retaining the lane openly is a judgement a reviewer can
contest.

## Discovery

**L1, closed.** All five of revision 1's open questions are now answered by
measurement, recorded in `reports/validation-slice1.md`:

1. **The `inject.mjs` extraction is not blocked.** The onboarding line (`:318-326`) and
   bypass banner (`:342-354`) are pure `lines.push` of locally-computed strings. The
   HANDOFF block (`:369-387`) is the `else if` arm of a two-arm branch — extract that
   arm's body alone; `ADOPT_SOURCES` excludes `compact`, so `handoffOutcome` is always
   null on the capsule path and only that arm is ever needed.
2. **`resolvePipeline` — the question rested on a false premise.** `buildSessionPreamble`
   (`:301-305`) and `buildPromptReminder` (`:477-479`) make the *identical*
   `resolvePipeline(root, { sessionId })` call. `buildSessionPreamble` was never the
   unfixed builder.
3. **`.bee/logs/` is safe.** Created by onboarding (`onboard_bee.mjs:2609`), and
   `appendJsonl` calls `ensureDir` (`fsutil.mjs:107-110`). A bare `fs.appendFileSync`
   would not be — which is why D4 routes through the module.
4. **The manifest step exists:** `node scripts/release_manifest.mjs --write`, with
   `--check`/`--selftest` already wired at `run_verify.mjs:57-58` and
   `ledger_parity.mjs --check` at `:64`.
5. **Doctrine propagation takes two commands** — `render_plugin_skill_trees.mjs` for the
   two plugin trees, `onboard_bee.mjs --apply` for `.claude/skills`, `.agents/skills`
   and the merged root `AGENTS.md`.

**Baseline measured green:** `run_verify.mjs` exit 0, 84 suites, 63.6 s.

## Approach

Unchanged in substance from revision 1, with one structural correction: the capsule is
the **body** of the compact orientation, never its anchor (D19). One new module
(`compaction.mjs`) owns everything durable and rendered; hooks and verbs are two thin
caller classes; three renderers are extracted from `inject.mjs` so both builders share
one truth rather than two copies.

## Slice 1 — eight cells, strictly serial (D21)

```
cz-1 → cz-2 → cz-3 → cz-4 → cz-5 → cz-6 → cz-7 → cz-8
```

| Cell | Scope | Verify |
|---|---|---|
| cz-1 | Doctrine text + every live stale corner, keeping the four counts apart (D25) + render→onboard→manifest chain + size budget | `test_agents_budget.mjs && release_manifest --check && run_verify.mjs` |
| cz-2 | The doctrine gate: derived scan set, four derived counts, `--selftest` that bites | `test_doctrine_parity.mjs --selftest && test_doctrine_parity.mjs` |
| cz-3 | `compaction.mjs`: append + counting, sweep, warning, anchor predicate — plus its own regen chain | module test + mirror + `release_manifest --check` + `ledger_parity --check` |
| cz-4 | Two verbs (`compact-log`, `compact-check`) — **not** `compact-capsule`; three named change sites beyond the registry | verb test + conformance + `test_bee_cli` + both regen checks |
| cz-5 | Renderer extraction + `buildCompactCapsule(root,{sessionId,handoffOutcome})` + the `compact-capsule` verb + its suite + a committed golden | capsule test + hook contracts + `test_bee_cli` + mirror + both regen checks |
| cz-6 | `SessionStart` compact branch passing `handoffOutcome`; `intentLeadBlock` untouched | capsule test + hook contracts + mirror + `release_manifest --check` |
| cz-7 | PreCompact warning + forced nudge; UserPromptSubmit deduped nudge; **owns the split of the PreCompact additivity row** (D23) | advisories test + hook contracts + mirror + `release_manifest --check` |
| cz-8 | Confirm the chain (a diff outside `updated_at` is itself a finding) + full verify recorded | `run_verify.mjs` |

Schedule verified: **8 waves, one cell each, zero cycles, zero unsatisfiable deps.**

### What revision 2 got wrong (corrections carried by these cells)

| Finding | Correction |
|---|---|
| The regen trigger was scoped to `templates/lib/` from assumption. Measured, `release_manifest.mjs:131,133` hashes `skills/**` and `hooks/**` — so the two hook cells carried the check that stays green (`ledger_parity`) and omitted the one that moves, and the doctrine cell carried neither and could not have capped. | **D24** — trigger widened, and `render_plugin_skill_trees.mjs` must precede `release_manifest --write` because `onboard --apply` never renders the plugin trees. |
| The mode-gate record claimed no existing assertion changes. False for PreCompact: the nudge fires only when no anchor exists, which is that row's control fixture. | **D23** — `cz-7` owns the split; the flag count returns to 5. |
| "No surviving 6-hook claim" would have ordered a worker to falsify a true statement — `.bee/config.json` has exactly 6 hook toggles. | **D25** — four-way count vocabulary; the gate derives all four and its own scan set. |
| `handoffOutcome` was asserted to be always null on compact. It is not. | **D26** — the extracted renderer takes it. |
| …and D26 stopped one level short: the capsule *call site* still dropped it, which no suite in the feature nor the full verify would have caught. | **D27** — the capsule signature carries it, asserted in both `cz-5` and `cz-6`. |
| `test_bee_cli.mjs` must be edited when a verb is registered, but no cell declared it. | Declared in `cz-4` and `cz-5`, with all three change sites named. |
| The byte-identity baseline as a `git show HEAD:` reconstruction would pass at cap and decay to a tautology for every later cell. | A committed golden at `scripts/fixtures/preamble-golden.txt`, version line normalized. |

## Test Matrix

Unchanged from revision 1 (absent/empty · first run · boundary counts · ordering ·
corrupt input · IO failure · idempotence · cross-runtime · concurrency · verbatim
preservation · negative control · config absent), with three rows now given owners
that revision 1 left unassigned:

- **cross-runtime** (capsule reachable by `state compact-capsule` alone, D3's whole
  helper-floor argument) → `chx-5`, which registers the verb.
- **idempotence** (the sweep mutates nothing) → `chx-3`, proven by hashing the `.bee/`
  tree before and after, not by comparing stdout.
- **negative control** (a deliberately broken capsule must not leave the
  `resume`/`startup`/`clear` assertions passing) → `chx-5`, via a captured-before
  comparison rather than relying only on the existing rows staying green.

## Risks & Mitigation

| Risk | Level | Mitigation |
|---|---|---|
| `inject.mjs` renderer extraction | MEDIUM (was HIGH — measured feasible) | The HANDOFF arm's blank-line ownership is the one fiddly decision; byte-identity is asserted by a captured-before comparison in `chx-5`'s own suite. |
| A behavior cell capping without red-failure evidence | MEDIUM | `chx-6` and `chx-7` name the obligation in their action text: record the red before wiring. |
| The derived doctrine gate not biting | MEDIUM | `chx-2`'s `--selftest` must exhibit both failure modes, following `release_manifest.mjs:239-292`. |
| Derived-artifact chain left stale | LOW (was the top finding) | D20 moves the regen into each lib-touching cell; `chx-8` only confirms, and reports any diff it finds as a finding. |
| Doctrine drift returning | LOW | The gate derives both counts and covers the root `AGENTS.md`. |

## Handoff

Gate 2 covers this revision's shape. Validating re-runs against the eight cells, with
the four previously-outstanding matrix rows now carrying evidence.
