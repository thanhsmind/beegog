# Validation — Codex repo-fallback incident, split cells 6a → 6b

**Feature:** `codex-runtime-parity` · **Current work:** `codex-parity-6a`, `codex-parity-6b` only
**Mode:** high-risk (no bypass) · **Date:** 2026-07-12
**Reviewers:** plan-checker persona panel (coherence / feasibility / scope-guardian / **security**) + cell reviewer — both on the `review` slot (**opus**)
**Verdict:** `READY WITH CONSTRAINTS`

Predecessor `codex-parity-6` was rejected by this gate and its Gate 3 approval revoked
(decision `83e029f0`). This validates its replacements.

---

## Baseline gate

`test_lib` **169/0** · `test_onboard` **PASS (0 failures)**. Green.

---

## Reality gate

```text
MODE FIT:      PASS  — rewrites the live trusted hook source of the running agent.
REPO FIT:      PASS  — renderProjection(runtime) exists (catalog.mjs:138) with only 4 call
                       sites, all in test_hook_contracts.mjs => parameterizing with a
                       `plugin` default is bounded. adapter.mjs already ships
                       SOURCE_IDENTITIES = {plugin, repo} and parses BOTH `--source=repo`
                       and `--source repo` (verified by runtime probe, both exit 0).
                       --catalog-only already exists as a real mode (test_hook_contracts.mjs:31).
ASSUMPTIONS:   PASS  — every blocking assumption below carries command/binary/runtime evidence.
SMALLER PATH:  PASS  — split 6a -> 6b. 6a remains ~1.5 cells (see Accepted constraint 1).
PROOF SURFACE: PASS  — BOTH cells' verify strings are RED today (exit 1) and cannot go
                       green without the real work. Re-verified after every repair.

Decision: proceed to Gate 3 with constraints.
```

---

## The transport — proved end-to-end (this is what killed the predecessor)

Rendered shape:

```sh
r="$(git rev-parse --show-toplevel 2>/dev/null)"
[ -n "$r" ] || { echo "bee: hook transport unavailable (no git root)" >&2; exit 0; }
exec node "$r"/hooks/bee-<script>.mjs --source=repo
```

| Condition | Exit | D2 requires | Evidence |
|---|---|---|---|
| non-git cwd (`/tmp`) | **0** | 0 (fail-open) | `.spikes/codex-runtime-parity/failopen.sh` |
| `git` absent from PATH | **0** | 0 (fail-open) | same |
| nested cwd inside repo | **0** | resolves + runs | same |
| repo root | **0** | resolves + runs | same |
| **counterfactual: same command WITHOUT the guard, non-git cwd** | **crash** | reproduces `MODULE_NOT_FOUND` | same |

The counterfactual is the point: the fail-open arm is **load-bearing, not decorative**.
Strip it and the "fix" reproduces the exact bug under repair.

---

## Feasibility matrix

| # | Assumption | Evidence | Result |
|---|---|---|---|
| A1 | Codex shell-interprets hook commands (so `$( )` resolves) | Shipped 0.144.1 binary: `hooks/src/engine/command_runner.rs` spawns `$SHELL -lc`. `CLAUDE_PROJECT_DIR` occurs **0** times in the binary. | **PROVED** |
| A2 | Hook process cwd permits git-root resolution | Official Codex Hooks contract (decision `d91a8398`): commands run with the session cwd; git-root resolution is the documented pattern. | **PROVED (contract)** |
| A3 | Rewriting `.codex/hooks.json` invalidates hook trust | 9 per-entry `trusted_hash` in `~/.codex/config.toml:37-63`. Per `d91a8398`, changed definitions are **skipped until the human reviews the new hash**. | **TRUE → Gate-4 checkpoint, not a cell truth** |
| A4 | `--source=repo` is already supported | `adapter.mjs:52` `SOURCE_IDENTITIES`; `parseSourceIdentity` accepts both forms; runtime probe → both exit 0. | **PROVED** |
| A5 | Both cells' verify is RED before the work | 6a exit **1**, 6b exit **1** (re-verified after repairs). | **PROVED** |
| A6 | 6b's RED-sensitivity ref is reachable | `git cat-file -t ba31819…` → `commit`; `.codex/hooks.json` exists at it. | **PROVED** |
| ~~X1~~ | ~~`[features] hooks = true` gates Codex hooks~~ | **RETRACTED.** My own spike set the flag and the control still did not fire — a config diff is not causation. Contract: hooks are ON by default. | **INVALID — must not reappear** |

---

## Blockers found by the panels — all repaired in-cell

The predecessor died of two things: *verify green against a broken config*, and *transport
string specified nowhere*. **Both tried to survive the split, through new doors.**

| id | Blocker | Repair |
|---|---|---|
| **B1** | **Skip rows count as PASS.** `failures = results.filter(r => !r.pass)` (`:1022`) while skip rows are built with `pass: true` (`:626-628`) — live precedent at `:620-630`. A worker could register the new drift row as `skip: true` ("codex CLI unavailable") and cap **green with zero work**. The `! --totally-bogus-flag` control blocks only the flag-ignored variant. | 6a truth: **required-row manifest** — row id `codex-repo-target-drift` absent **or skipped** ⇒ non-zero. 6b prohibition: no required row may be `skip:true`. |
| **B2** | 6a's verify never ran the **bare default suite** — while the cell's headline task is *rewriting argv parsing*, the fastest way to break the 71-row default path. | `node hooks/test_hook_contracts.mjs` (bare) appended to 6a's verify. |
| **B3** | 6a told the worker to *implement* `--catalog-only`. **It already exists** (`:31`, built by cell parity-2). A cold worker would rebuild it and break parity-2's contract. | Action reworded: **extend** the existing group; the only new argv work is strict rejection. |
| **B4** | The fail-open diagnostic pinned **neither stream nor literal**, and collided head-on with 6b's "Stop stdout must be JSON" truth **on the same command**. The report's own sketch (`[ -n "$r" ] \|\| exit 0`) is *silent* — violating spec R2. | Pinned exactly: literal `bee: hook transport unavailable (no git root)` → **stderr**, stdout **empty**, exit 0. 6b asserts it mechanically. |
| **B5** | 6b **prohibited** claiming a missing `git` executable as proved — i.e. the cell forbade testing the branch that reproduces the exact `MODULE_NOT_FOUND` under repair. Half of F2's remedy was dropped, not fixed. | Prohibition struck. 6b now **requires** a PATH-shimmed git-absent row: exit 0 + stderr literal + empty stdout. |
| **W3** | `git diff --exit-code -- …` compares worktree→**HEAD**. Cells commit. A worker who commits a mangled `hooks.json` **passes clean** — the S3 replacement guard was defeatable by the normal workflow. | Pinned to the ref: `git diff --exit-code ba31819… -- hooks/hooks.json hooks/claude-hooks.json`. |
| **6b-C2** | `.codex/hooks.json` is **byte-identical to the pre-fix ref today**, so 6b's RED@ref/GREEN@active is *physically unobtainable* until 6a lands — inviting a worker to **fabricate a RED**. | 6b truth now carries a `[BLOCKED]` guard: if the ref still matches the worktree file, STOP; never report a RED you did not observe. |

Re-verified after every repair: **6a exit 1, 6b exit 1.** Still RED.

---

## Closed from the original rejection

C1 (Gate-4 re-trust named) · C2 (`approach.md` contradiction gone — now keep-and-repair) ·
C3 (plugin source identity deferred) · C4 (RED-first on both row sets) · S1 (exactly the
`renderProjection(runtime,{target})` parameterization demanded) · S3 (→ pinned-ref diff) ·
F2 (fail-open **proved**, both branches) · F3 (Windows declared out of scope) ·
X1 (correctly absent).

---

## Accepted constraints (carried into execution, not blockers)

1. **6a is ~1.5 cells.** The strict-argv refactor exists to make *6b's* verify meaningful.
   Accepted rather than split again — it is ~30 lines with its own RED.
2. **Dispatch 6a to a Claude worker, not a Codex one.** This session's write-guard runs from
   `.claude/settings.json` → `.bee/bin/hooks`, **not** `.codex/hooks.json`, so a Claude worker
   cannot brick itself mid-cell. A Codex-hosted worker would rewrite its own live hook source
   and (per `d91a8398`) watch its own guards go dormant at the riskiest moment.
3. **Windows / non-POSIX `$SHELL`** (fish, nu) are named coverage gaps, not proved. 6b pins
   `bash -lc` and points `HOME`/`CODEX_HOME` at the fixture so an rc-file `cd` cannot let
   git-root resolution escape into the live repo.
4. **Post-6a divergence** — Codex runs the current guarded wrappers while Claude keeps running
   the stale pre-adapter vendored ones. Filed P2; owned by the E2 Distribution slice.
5. **Gate 4 will require a human re-trust** of the 9 rewritten hooks in a fresh Codex thread
   (`/hooks` shows trusted rows + a clean Stop). Not automatable, by design.

---

## Approval block

**Feasibility verdict:** `READY WITH CONSTRAINTS`
**Gate 3:** requested — high-risk, **no bypass**, human decision.
**Scope of approval:** `codex-parity-6a` and `codex-parity-6b` **only**. Remaining E2, and all
E3/E4 work, return to planning.
