# Validation — Codex repo-fallback incident

> **Superseded shape — historical report.** This report correctly rejected the
> overloaded one-cell plan, but two feasibility conclusions below were later
> corrected by the official Codex Hooks contract. Do not dispatch
> `codex-parity-6` from this report; planning now prepares split cells 6a/6b for
> a fresh validation and a new Gate 3.

## Post-report evidence correction (2026-07-12)

- **A2 is closed by authoritative contract:** Codex states that commands run
  with the session cwd and explicitly recommends git-root resolution for
  repo-local hooks. The same page uses `$(git rev-parse --show-toplevel)` in its
  examples. An interactive cwd probe is therefore not a planning blocker;
  execution still tests root, nested, and no-root process rows.
- **X1 is invalid:** the official contract says hooks are enabled by default and
  disabled only with `features.hooks = false`. The spike control failed to fire
  both without and with `features.hooks = true`, so that experiment proved
  neither a requirement nor a default. No onboarding/config flag work belongs
  in this incident slice.
- **C1 is confirmed and reclassified:** changed non-managed hook definitions are
  skipped until the human reviews their new hash. Implementation must never
  mutate/bypass trust; `/hooks` review plus fresh-event UAT is an explicit Gate-4
  checkpoint, not an automated cell truth.
- **Still valid:** resolve the approach contradiction, scope “one source” to
  Codex, split renderer/config work from the process harness, preserve existing
  projections mechanically, and record RED sensitivity before GREEN.

Authoritative source: `https://learn.chatgpt.com/docs/hooks`; durable decision:
`d91a8398-2d63-426b-a133-341568453200`.

**Feature:** `codex-runtime-parity`
**Current work:** `codex-parity-6` only
**Mode:** high-risk (no bypass — hard-gate flags: audit/security, external runtime, public contract)
**Date:** 2026-07-12
**Reviewers:** plan-checker persona panel + cell reviewer, both on the `review` slot (**opus**)
**Verdict:** `NOT READY - RETURN TO PLANNING`

> **Supersedes** the earlier revision of this file, which recorded
> `READY WITH CONSTRAINTS` with `ASSUMPTIONS: PASS` and `PROOF SURFACE: PASS`.
> Both were wrong. The cell's verify command is **green today against the broken
> config**, so the proof surface covers none of the cell's first four truths; and
> the transport assumption was never specified, let alone proven. Re-validated
> from evidence below.

---

## Baseline gate

| Check | Result |
|---|---|
| `node skills/bee-hive/templates/tests/test_lib.mjs` | **169 passed, 0 failed** |
| `node skills/bee-hive/scripts/test_onboard_bee.mjs` | **PASS** — 0 failures, 1 skipped |

Green. Nothing was built on red.

---

## Reality gate

```text
REALITY GATE REPORT
Mode: high-risk
Current work: repair the trusted Codex project hook route, no plugin install/migration.

MODE FIT:      PASS  — rewrites the live, trusted hook source of the running agent.
REPO FIT:      PASS  — every named file exists: hooks/catalog.mjs (179L, renderProjection),
                       hooks/adapter.mjs (253L, findRepoRoot), hooks/test_hook_contracts.mjs
                       (1108L), .codex/hooks.json (9 live commands).
ASSUMPTIONS:   FAIL  — the hook-process cwd is unproven (F2), and the trusted_hash
                       invalidation (C1) and [features] flag (X1) were never modelled.
SMALLER PATH:  FAIL  — the cell is >=2 cells of work (SCOPE OVERLOAD).
PROOF SURFACE: FAIL  — `node hooks/test_hook_contracts.mjs` is GREEN today, against the
                       broken .codex/hooks.json. It covers none of truths 1-4.

Decision: reality gate FAILS -> return to planning.
```

---

## Direct cause — reproduced (RED)

From Codex's **own** session rollout logs (`~/.codex/sessions/2026/07/…jsonl`) — commands
Codex itself executed, not a shell repro:

```
Cannot find module '/.bee/bin/hooks/bee-session-close.mjs'
Cannot find module '/.bee/bin/hooks/bee-session-init.mjs'
Cannot find module '/.bee/bin/hooks/bee-state-sync.mjs'
```

All nine configured commands are `node "$CLAUDE_PROJECT_DIR"/.bee/bin/hooks/<script>`.
Codex never sets that Claude-only variable → it expands to empty → `/.bee/…`.
Confirms `diagnosis-codex-stop-hooks.md`.

---

## Feasibility matrix

| # | Assumption | Proof required | Evidence | Result |
|---|---|---|---|---|
| A1 | Codex shell-interprets the `command` string (so `$( )` resolves) | Observed exec mechanism | **Shipped 0.144.1 binary**: hook command runner `hooks/src/engine/command_runner.rs` spawns **`$SHELL -lc "<command>"`**. Also: `CLAUDE_PLUGIN_ROOT`/`CLAUDE_PLUGIN_DATA` present in binary; **`CLAUDE_PROJECT_DIR` occurs 0 times**. | **PROVED** |
| A2 | The hook **process cwd** is inside the worktree, so `git rev-parse --show-toplevel` resolves | A captured cwd from a real Codex-run hook | **None.** The payload carries `cwd`; nothing establishes the *process* cwd. If Codex spawns hooks outside the worktree — or `git` is off `PATH` — `$(…)` yields empty → `node ""/hooks/bee-*.mjs` → **the identical MODULE_NOT_FOUND being fixed.** | **UNPROVEN — BLOCKER** |
| A3 | Rewriting `.codex/hooks.json` leaves hook trust intact | Trust survives a content rewrite | `~/.codex/config.toml:37-63` — nine per-entry `trusted_hash = "sha256:…"` keyed `…/hooks.json:<event>:<group>:<idx>`. A content rewrite invalidates them. | **FALSE — BLOCKER** |
| X1 | Codex runs project hooks at all on a clean machine | Hooks fire without extra config | **They do not.** `~/.codex/config.toml:73-74` carries `[features] hooks = true`. Without it: **no hook runs, silently — exit 0, no warning.** Spike `q3-cmdsubst`, run 1. | **FALSE — BLOCKER (new)** |
| A4 | The shared adapter can resolve the repo root at runtime | Code inspection | `hooks/adapter.mjs:90,209` — `findRepoRoot(cwd)` walks up from `payload.cwd`. | **PROVED** |
| A5 | The cell's verify covers the cell's truths | Run it | `node hooks/test_hook_contracts.mjs` → **71 rows, ALL PASS** while the live config is broken. | **PROVED FALSE** |
| A6 | Dependency closure is complete | Cell graph | `{1,2,2b,3,4,4b}` all capped; `catalog.mjs` (cell 2) and `adapter.mjs` (cell 3) covered transitively. | **PROVED** |

---

## Blockers

### C1 — the cell provably cannot close the incident it exists to close
Rewriting `.codex/hooks.json` changes every hook definition, invalidating the nine
`trusted_hash` entries that make these hooks live. The cell **simultaneously prohibits**
touching `~/.codex` (`codex-parity-6.json:58`) and names **no human re-trust checkpoint**.
So on merge the rewritten hooks are untrusted; its truths ("both Stop commands exit 0")
are only provable inside the harness, never on the user's machine.
→ Needs an explicit out-of-cell Gate-4 human step: re-trust the nine rewritten hooks in a
fresh Codex thread, capture `/hooks` showing trusted rows + a clean Stop.

### F2 — the fix's failure mode is byte-for-byte the bug it repairs
`git rev-parse --show-toplevel` is **cwd-dependent**, and the hook process cwd is
established by nothing in-repo or in the binary. Outside a worktree, or with no `git` on
`PATH`, the command collapses to `node ""/hooks/bee-*.mjs` → `MODULE_NOT_FOUND` exit 1.
The cell requires **no fail-open** on unresolvable root — while **D2 demands visible
fail-open** (`docs/specs/hook-runtime.md:99-100`).
→ Render fail-open instead:
```sh
r="$(git rev-parse --show-toplevel 2>/dev/null)"; [ -n "$r" ] || exit 0
exec node "$r"/hooks/bee-<script>.mjs --source repo
```
→ Add harness rows: (a) cwd outside any repo, (b) `PATH` without `git`. Both must exit 0.

### X1 — Codex hooks are gated behind an experimental feature flag  *(new — found by spike)*
```toml
[features]
hooks = true
```
Without it **no project hook runs at all**, silently. Nothing in `plan.md`, `CONTEXT.md`,
`approach.md`, or `docs/specs/hook-runtime.md` mentions it; onboarding never sets or checks
it; a fresh user will not have it.
→ The slice's business rule *"exactly one active bee hook source"* is **false by default on
a clean machine — it has zero.** A healthy install and a silently-dead install are today
indistinguishable. This is an E2 distribution + onboarding + spec gap.

### S3 — the byte-identity truth is enforced by nothing
Truth 5 ("plugin + Claude projections remain byte-identical to their pre-cell forms") is
unfalsifiable: the drift rows compare `renderProjectionText(x)` to the checked-in file — a
**self-consistency** check. Edit `catalog.mjs`, regenerate both projections, and the suite
stays green while both files' bytes changed.
→ Replace with `git diff --exit-code -- hooks/hooks.json hooks/claude-hooks.json`, or pin
pre-cell `sha256` constants in the suite.

### S2 — truth 6 is false at repo scope
"exactly one active bee hook source" ignores Claude: `.claude/settings.json` still wires
**ten** hooks to `.bee/bin/hooks/*`, and **all seven vendored wrappers differ from source**
(`adapter.mjs` isn't vendored at all — they're pre-parity: no hostile-stdin normalization,
no `apply_patch` guard, plain-text Stop). Post-cell, Codex-in-this-repo runs the *current*
guarded wrappers while Claude-in-this-repo keeps running the *stale* ones.
→ Reword to "the only active **Codex** bee source" and name the divergence as a backlogged
gap (the existing "repo `.bee/bin/hooks` stale until re-onboard" item).

---

## Warnings

| id | Finding |
|---|---|
| C2 | `approach.md:36-38` (a cell `read_first`) says **remove** `.codex/hooks.json` and generate the fallback from **onboarding**. The cell keeps it checked in, renders it from the catalog, and forbids touching onboarding. Two approved artifacts now disagree — a cold worker gets contradictory orders. |
| C3 | `approach.md:42` says every Codex command passes source identity (`plugin`\|`repo`), but the plugin projection passes **none** (`catalog.mjs:38`) and truth 5 pins those bytes. A worker who "fixes" it destroys truth 5. State the deferral explicitly. |
| C4 | RED-first is specified only for the incident repro, not for the new suite rows. Since the suite is green today, a worker can add rows *after* the fix and never show they fail on the old config. |
| F3 | Codex's hook schema has a separate **`commandWindows`** field (binary: `HookHandlerConfig::Command` = `command`, `commandWindows`, `timeout`, `async`, `statusMessage`). A POSIX-only `$( )` render is **Windows-broken by construction**. Emit `commandWindows` too, or declare it out of scope. |
| F4 | Commands run under **`$SHELL -lc`** — the user's **login** shell, with rc files, not `/bin/sh`. A non-POSIX `$SHELL` (fish/nu) and rc side effects are untested. The harness must spawn the same way (`bash -lc`, not `execFile`) to be a faithful installed-route test. |
| S1 | The catalog becomes a partially-populated 2×2 (claude/codex × plugin/repo) where the claude-repo cell is still hand-coded in `onboard_bee.mjs renderRepoHookEntries()` **using a different convention** (`$CLAUDE_PROJECT_DIR` + `.bee/bin/hooks/`) than the new codex-repo cell (git root + `hooks/`). Two divergent repo-target encodings is a worse shape than either extreme. **Do not fold arch-F3 into this cell** — that drags onboarding + every host's `.claude/settings.json` into an incident fix. Instead **parameterize** the renderer: `renderProjection(runtime, { target: "plugin" \| "repo" })`, so onboarding can adopt it unchanged later. |

---

## Cell review — cold pickup (opus): **NOT READY**, 5 CRITICAL

Transport string specified nowhere (worker must *invent* what gets baked into the live hook
config) · `approach.md` contradicts the cell · truth 5 unfalsifiable · verify green today =
zero coverage · **SCOPE OVERLOAD**: three cells wearing one hat — (1) catalog repo-transport
+ regenerate config + drift row; (2) a new process-level harness (parse 9 commands,
synthesize payloads for 7 events, scrubbed env, root **and** nested cwd, ~18+ spawns, Stop-JSON
assertions); (3) the RED-evidence ritual — on top of an already 1108-line suite.

---

## Required before re-validation

1. ~~Settle A2 through an interactive probe.~~ **Closed by the official cwd and
   git-root contract; retain process-level root/nested/no-root tests.**
2. ~~Fold `features.hooks = true` into onboarding/spec.~~ **Rejected: the spike
   was inconclusive and official docs state default-enabled behavior.**
3. **Model C1** — the human re-trust step, as an explicit Gate-4 checkpoint.
4. **Resolve C2** — current source-repo repair in place; onboarding-generated
   host fallback/removal remains in the later Distribution slice.
5. **Split the cell**: `codex-parity-6a` (parameterized catalog repo-target
   renderer + regenerated config + byte-drift row) → `codex-parity-6b`
   (process-level installed-route harness, nested cwd, Stop JSON), with 6b
   depending on 6a.
6. **Make truths mechanical** — `git diff --exit-code` for preserved projections;
   demonstrate each new contract RED against the pre-fix config before GREEN.

---

## Approval block

**Feasibility verdict:** `NOT READY - RETURN TO PLANNING`
**Gate 3:** **not requested.** No execution approval sought or granted.

**Blocked, not failed.** The direct cause is confirmed and the official runtime
contract supports the selected transport. The old one-cell shape remains
invalid; the split 6a/6b shape must pass a fresh reality gate and reviewer panel
before a new Gate 3 is presented. Live activation remains intentionally pending
until the human trusts the changed definitions at Gate 4.

Spike: `.spikes/codex-runtime-parity/q3-cmdsubst/` (`RESULT.md`, `run.sh` — isolated
`CODEX_HOME`, never touches `~/.codex`).
