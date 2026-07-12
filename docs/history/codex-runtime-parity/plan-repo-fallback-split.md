---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: high-risk
slice_of: codex-runtime-parity
supersedes_cell: codex-parity-6c (single-cell form, failed validation)
---

# Slice plan — repo-fallback fix, split of failed codex-parity-6c

Slice of the `codex-runtime-parity` feature plan (`plan.md`). Locked decisions unchanged:
**D1** (Codex distribution is plugin-first; exactly one active hook source — *distribution*, not
byte-identity), **D2** (full hook parity; shared helpers are the final belt; unsupported paths fail
open with visible limits). This slice does not reinterpret either.

## Why a re-plan

The single cell `codex-parity-6c` failed validation NOT READY with 3 spike-proven BLOCKERs
(`reports/validation-codex-parity-6c.md` → "Validation verdict"). Per human decision it splits into
two cells. Mode stays **high-risk** (audit/security deny-guard bypass + authorization + external
runtime + existing covered behavior + cross-platform POSIX walk).

## Discovery (L1 — the one design question, spike-proven)

Crux: redesign the anchor/walk so a forged nearer bee root under an allowlisted-writable prefix
cannot shadow the real root. Resolved by `.spikes/codex-runtime-parity/marker-walk-outermost.sh`:

| case | nearest-ancestor (current) | outermost-wins (proposed) | want |
|---|---|---|---|
| legit: cwd at real root | 2 DENY | 2 DENY | 2 |
| **spoof: cwd in `.spikes/`, both markers planted** | **0 ALLOW (bypass)** | **2 DENY** | 2 |
| no bee root anywhere | 2 DENY | 2 DENY | 2 |

`.spikes/`, `docs/`, `plans/` are in `GATE_ALLOWED_PREFIXES` (`guards.mjs:31`) and always sit *below*
the real root, so a planted both-markers root is always deeper. **Outermost-marker-wins** skips it
and resolves the real root; nearest-ancestor (today's `adapter.findRepoRoot`) is the exploitable
direction.

**Second-order finding.** Even with an outermost transport, the guard re-resolves its own root via
`findRepoRoot(cwd)` (nearest, `adapter.mjs:207`) and normalizes the target against it
(`toRelPath`, `bee-write-guard.mjs:38`). A gated write from a spoof cwd is currently denied only
because the target *escapes the wrong root* (`bee-write-guard.mjs:175-194`) — emergent, accidental
safety of exactly the two-root-disagreement class this whole fix exists to kill.

## Round-3 update (2026-07-12) — guard-side causal close

Round-2 validation found design B (outermost walk) still spoofable: it trades the below-root spoof
for an **above-root** one — an untrusted agent plants both markers *above* the real root (the guard
escape-allows out-of-repo Write/Edit), and outermost selects the attacker root
(`aboveroot-plant.sh`, decision `ec629bfe`). Human chose **Option 1 — harden the guard**. Added to
6c: the guard DENIES any *governed* write that would create a marker file (`.bee/onboarding.json`
under `.bee/`, or `hooks/bee-write-guard.mjs` under `hooks/`) resolving OUTSIDE the resolved real
root, so a forged root cannot be planted — spike-proven to block 4 plant vectors while leaving legit
out-of-repo non-marker writes (`/tmp`, `/var/log`) untouched (`guard-deny-marker-forge.mjs`).
**Residual (documented, D2):** an *ungoverned* Codex write path (unified_exec / native — already spec
Open Gaps) could still plant markers; hooks are not a complete boundary. Truth #3 is rescoped to
below-root-closed + above-root-plant-denied-for-governed-writes.

## Approach — B (single-source root) + guard-side marker-forge deny (round-3)

1. Repo-target transport resolves via an **outermost** POSIX marker walk (both markers), not `git rev-parse`, not nearest.
2. Transport passes `--repo-root="$r"` to the guard; guard trusts the marker-validated passed root, falls back to its walk only when the arg is absent (keeps the plugin route intact).
3. PreToolUse fails **closed** (exit 2 + pinned corrective) when no outermost bee root resolves; the 8 advisory commands fail **open** (exit 0 + pinned diagnostic) — never exit 2 (block verdict on Stop/SubagentStop), never a bare MODULE_NOT_FOUND crash.

**Rejected — A (transport-only outermost, guard keeps nearest):** smaller, but leaves two root
definitions coexisting and leans on `toRelPath`'s escape-deny backstop — the same "safe by accident"
shape as the original incident. Rejected on principle, not feasibility.

| component | risk | proof before execution |
|---|---|---|
| outermost marker walk (POSIX in a shell string) | MEDIUM | spike PASS above; `/`-termination + `${d%/*}` handled by worker |
| guard `--repo-root` arg (new) | MEDIUM | plan-checker + a spoof route arm; fallback-to-walk keeps plugin path intact |
| route arms 3/4 inversion (off-git) | MEDIUM | enumerated below; suite red-then-green |
| matcher byte change to plugin projections | LOW | real D1 is distribution; loosen verify pin |
| Codex treats shell exit-2 as PreToolUse deny | LOW (unprovable in repo) | rides the same post-merge UAT as the matcher |

## Slice — two cells (current slice only)

### codex-parity-6c (revised) — deny-capable transport fails CLOSED, single-sourced root
Files: `hooks/catalog.mjs`, `hooks/adapter.mjs`, `hooks/bee-write-guard.mjs`, `.codex/hooks.json`,
`hooks/test_hook_contracts.mjs`, `docs/specs/hook-runtime.md`.
- Outermost marker walk in the repo transport; thread `event` into `commandFor` (byte-safe for plugin/Claude — proven); PreToolUse fail-closed exit 2, 8 advisory fail-open exit 0; transport passes `--repo-root`; guard trusts it, falls back to walk when absent.
- Rework route arms 3 & 4 (off-git inverts their assertions); add a real both-markers spoof route arm under `.spikes/` (absolute write to real `.bee/state.json` → exit 2); add its id to `routeRequiredRowIds` + required-row manifest.
- Correct the false `REPO_TRANSPORT_UNAVAILABLE_DIAGNOSTIC` literal + stale catalog comments; pin the corrective deny literal as an exported constant.
- Finalize spec R2/B6; drop the "under revision" Open Gap qualifier.
- **behavior_change: true.** `.codex/hooks.json` regen re-invalidates `trusted_hash` → Gate-4 re-trust (guard OFF on Codex until re-trusted).

### codex-parity-6d (new) — apply_patch matcher hardening
Files: `hooks/catalog.mjs`, `hooks/hooks.json`, `hooks/claude-hooks.json`, `.codex/hooks.json`,
`hooks/test_hook_contracts.mjs`.
- Add `apply_patch` to the shared `runtimes: BOTH` write-guard matcher; regenerate all three projections (plugin bytes change — compatible with real D1).
- Loosen the verify D1 pin to tolerate the single matcher delta; drop the "byte-identical" framing.
- Add a matcher-assertion route row.
- Depends on 6c. Carries the **post-merge Codex `apply_patch` deny UAT** as a stated Gate-4 dependency; if it fails, a follow-on cell makes `apply_patch` a codex-only `ALLOWED_DIFFERENCES` matcher.

## Test matrix (edge dimensions)
Failure modes: bare repo · non-git cwd · foreign nested git root · both-markers spoof · no bee root ·
root with hooks/ but no onboarding.json (marker load-bearing). Boundaries: filesystem-root walk
termination · spaces+Unicode paths · nested cwd. Idempotency: `.codex/hooks.json` byte-stable across
re-render. Security: spoof under each allowlisted prefix · guard root single-sourced. Observability:
one visible diagnostic per advisory failure · pinned corrective on deny.

## Open questions for validating
1. Byte-safety of the `--repo-root` addition to the repo command string across plugin/Claude projections.
2. Guard `--repo-root` fallback leaves the plugin route byte- and behavior-identical.
3. The spoof spike re-run as a real in-suite route arm, not standalone.
