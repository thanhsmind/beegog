# Validation — cell codex-parity-6c (deny-capable transport fails CLOSED)

> **VERDICT (2026-07-12): NOT READY — RETURN TO PLANNING.** High-risk persona panel (opus) + cold-pickup cell review (opus) each independently returned three cross-corroborated BLOCKERs, every one proven with a runnable spike, not asserted. Gate 3 was **not** presented. See "Validation verdict" at the foot of this file. The fan-out "verified in-spike (marker-walk)" claims below were **not** backed by the on-disk spikes — `.spikes/codex-runtime-parity/validate-6c.sh` implements the *rejected* `git rev-parse`+`-f` transport, never the adopted marker walk. Read the sections below as the *original* fan-out summary, corrected by the verdict at the end.

**Feature:** `codex-runtime-parity` · **Fix cell for review P1-a / P1-b / matcher-P2**
**Method:** 4-agent fan-out (generation tier, sonnet), isolated git fixtures, real catalog rendered read-only. No forbidden files touched; no commits.
**Human decisions (Gate 4, 2026-07-12):** matcher = *accept inference + harden anyway*; shape = *marker-walk, 9 strings*.

---

## Scope

Repairs the source-repo Codex PreToolUse transport so a deny-capable checkpoint fails **closed** when its handler cannot be located, without regressing the advisory events or disturbing locked decision D1. Supersedes the review's one-string `-f` prescription, which fan-out proved insufficient.

## Evidence carried forward from fan-out

### P1-a — write-guard fails OPEN (CONFIRMED, review-correct)
`git config core.bare true` → `git rev-parse --show-toplevel` exit 128 → `$r` empty → fail-open arm exits **0 (ALLOW)** on an Edit/apply_patch targeting `.bee/state.json`. Reproduced end-to-end. The prescribed exit-2 arm closes it (verified: bare repo → exit 2, `bee write guard: cannot resolve repo root — refusing write`).

### P1-b — nested/foreign git root (CONFIRMED, and review's fix is INSUFFICIENT)
Current transport: cwd inside a different git root → `$r` non-empty but wrong → `exec node "$r"/hooks/bee-write-guard.mjs` → `MODULE_NOT_FOUND` exit 1 → Codex treats exit 1 as non-blocking → write proceeds.

**The review's `-f "$r/hooks/bee-write-guard.mjs"` check does not close the full class — it worsens one subcase.** Verified load-bearing facts:
- `.spikes/` is in `GATE_ALLOWED_PREFIXES` (`.bee/bin/lib/guards.mjs:31`) — an untrusted agent may write there in every phase.
- The transport resolves root via `git rev-parse`; the node guard resolves via `.bee/onboarding.json` ancestor-walk (`hooks/adapter.mjs:89-92`, `findRepoRoot`). **Two different root definitions that disagree exactly in the failure cases.**

Reproduced spoof: agent writes `.spikes/scratch/hooks/bee-write-guard.mjs = process.exit(0)` and `git init`s that dir (both allowed). PreToolUse with cwd in `.spikes/scratch/` → `$r` = spoof root, `-f` passes, execs the **attacker's** guard → real absolute write to `.bee/state.json` → **exit 0 (ALLOW)**. The `-f` fix converts P1-b's loud crash into a silent allow.

**Adopted fix (verified in-spike):** resolve the deny-capable transport root by POSIX ancestor-walk for a directory carrying both `.bee/onboarding.json` and `hooks/bee-write-guard.mjs`, matching `adapter.findRepoRoot`; else exit 2. Results: bee bare repo → exit 2; spoof nested non-bee root, absolute write to real state → exit 2 (walk skips spoof, finds real bee root, real guard runs); no bee root → exit 2; non-gated write from real root → exit 0.

### Shape is 9 strings, not 1 (CONFIRMED)
Applying fail-closed globally makes Stop/SubagentStop exit 2 = a block/turn-control verdict → violates B2/R4. So exit-2 is PreToolUse-only; `event` must thread into `commandFor`. But the 8 advisory arms still `exec node "<foreign-root>"/hooks/bee-state-sync.mjs` → MODULE_NOT_FOUND exit 1 in a foreign root — a stack trace, not a diagnostic → violates R2 ("fail-open is visible, never silent") and B1 ("never crashes the turn"). Therefore all 9 repo-target commands gain the marker check: PreToolUse → exit 2 + corrective; the 8 advisory → exit 0 + pinned diagnostic.

### D1 preserved by construction (CONFIRMED)
`event` threads into `repoCommand` only (the deny branch); the plugin branch of `commandFor` never reads `event`. Scratch harness rendering the real catalog: plugin-target Codex + Claude projections byte-identical to `hooks/hooks.json` / `hooks/claude-hooks.json`; exactly one repo-target string changes per the PreToolUse rule (before the advisory-arm decision). No new positional arg; `renderProjection`/`renderProjectionText` signatures unchanged. No `ALLOWED_DIFFERENCES` entry needed.

### Matcher (P2) — premise REFUTED, hardening adopted
Codex matches `matcher` against alias set `{apply_patch, Edit, Write}` for apply_patch calls (official hooks contract cited at `docs/specs/hook-runtime.md`; openai/codex PR #18391 merged 2026-04-22, ~11 weeks before the installed 0.144.1 build, whose binary carries the `apply_patch` PreToolUse payload). bee's matcher already contains `Edit`/`Write`, so the guard **does fire** on `apply_patch`. Strong inference, not a runtime observation on this exact build.
- **Decision:** accept the inference; harden by adding `apply_patch` to the shared `runtimes: BOTH` matcher at `hooks/catalog.mjs:121` (inert no-op in Claude projection, load-bearing in Codex; no divergence, no new allowed difference). UAT is a post-merge confirmation item, not a blocker.

### Injection-hardening (P3) — REFUTED as needed
`script` and the echo argument are compile-time catalog constants; `$r` is double-quoted in the exec. Adversarial root dir names (`$(touch …)`, `; touch …`) produced no execution. Keep script-name validation only as inert belt-and-suspenders; it closes nothing today.

## Harness gap to fix inside 6c
`buildRouteFixture()` copies `hooks/` into the fixture root, so every arm resolves a root that always has the guard — the marker/`-f` check is dead code and P1-b is invisible. **New arm 5 required:** a second, separate `git init`ed directory with NO `hooks/`, cwd nested inside it. This is 6c's honest RED. Add `codex-repo-target-transport` + a new `codex-repo-target-pretooluse-failclosed` row to the required-row manifest; add the arm-5 route id to `routeRequiredRowIds`.

## Blast radius
Regenerating `.codex/hooks.json` invalidates its 9 per-entry `trusted_hash` values (`~/.codex/config.toml`); per decision `d91a8398` each changed definition is skipped until the human re-trusts. **Between merge and re-trust the write-guard is OFF on Codex** — the `/hooks` re-trust step is mandatory, not garnish. Gate-4 UAT (same shape as 6a's).

## Spec deltas (already partly captured by scribing; 6c finalizes R2/B6)
- **R2** — add: a deny-capable checkpoint fails CLOSED when its transport cannot start; "unknown" is not "safe" for a deny hook; advisory checkpoints keep visible fail-open.
- **B6** — root resolution is a precondition of the checkpoint running at all; confirm both a resolved bee-marked root AND the handler beneath it before launching; a silently-absent deny checkpoint is a defect.
- Remove the "under revision" qualifier from the scribing Open Gap once 6c lands.

## Out of scope for 6c (stated dependency)
If the post-merge matcher UAT unexpectedly fails, the fail-closed transport still never routes on `apply_patch` and a separate cell is needed. 6c is approved with that dependency named, not folded in.

---

## Validation verdict (persona panel + cold-pickup, 2026-07-12)

**NOT READY — RETURN TO PLANNING.** Three independent BLOCKERs, each proven by a runnable spike and corroborated across both reviewers:

**B1 — matcher hardening breaks the cell's own D1 pin and verify (panel F2 / cold-pickup C1).**
The write-guard matcher is one shared `runtimes: BOTH` string; `hooks/hooks.json:28` AND `hooks/claude-hooks.json:28` both carry it verbatim. Adding `apply_patch` changes the bytes of BOTH plugin files. That contradicts must_haves.truth #7 ("plugin projections byte-identical") and the verify clause `git diff --exit-code 7499a71 -- hooks/hooks.json hooks/claude-hooks.json` (confirmed clean now → flips red on the change). **Correction of record:** real D1 (CONTEXT.md:25) is *plugin-first distribution / exactly one active source* — it says nothing about byte-identity. The byte-identical invariant was cell-author framing carried from the fan-out, not a locked decision. The human's decision to harden the matcher stands; the cell's truth #7 + verify pin must be loosened to tolerate the single matcher delta (or the matcher moved to a codex-only ALLOWED_DIFFERENCES). "Behaviorally inert on Claude" ≠ "byte-identical" — the fan-out and the cell conflated them.

**B2 — the off-git marker transport inverts existing route arms 3 & 4 (panel F3 / cold-pickup C2).**
`route-nongit` (arm 3) and `route-gitabsent` (arm 4) both assert `expectTransportFailOpen` (exit 0 + "no git root" literal) for all commands, on the premise that git-resolvability governs the transport. A marker walk ignores git: arm 4's cwd (`fixture.nested`) sits under a real bee root, so PreToolUse now denies (exit 2) and advisories run — every arm-4 assertion flips. The cell only names "add arm 5 + split the static drift row"; the arms-3/4 rework is unspecified, so a correct implementation ships red or weakens assertions.

**B3 — the security core (spoof-skip, truth #3) is unproven and mis-tested (panel F1 / cold-pickup C3).**
(a) The both-markers spoof survives: `.spikes/`, `docs/`, `plans/` are all in `GATE_ALLOWED_PREFIXES` (guards.mjs:31) and `DIRECT_EDIT_DENY` matches only the exact rel path `.bee/state.json` (guards.mjs:44-45), never a nested `.spikes/s/.bee/state.json`. An attacker plants BOTH `.bee/onboarding.json` and `hooks/bee-write-guard.mjs` under `.spikes/`; the nearest-ancestor walk (adapter.mjs:89-100) finds the planted root before the real one and execs the attacker's `exit(0)` guard → ALLOW on a real gated write. Proven: `.spikes/codex-runtime-parity/q3-cmdsubst/spoof_check.mjs`. (b) Planned arm 5 (a git root with NO hooks/) exercises only the fail-CLOSED not-found path, never the `.bee/onboarding.json` marker being load-bearing, and never a spoof. (c) No on-disk spike implements the adopted marker walk — the present spikes are the rejected git-based transport.

**Additional (non-blocking, fold into re-plan):** panel F4/F5/F6/F7/F8/F9 and cold-pickup M1–M5 — stale `REPO_TRANSPORT_UNAVAILABLE_DIAGNOSTIC` literal ("no git root" becomes false), unpinned corrective deny literal, `$r` regex coupling, the fail-closed R9/B9 reversal lacking a D-ID, shell exit-2-as-deny for PreToolUse riding the same Gate-4 UAT as the matcher, and the panel's judgment that this is honestly **two cells** (transport fix + matcher hardening — the matcher is the sole source of B1 and the cell already defers its ALLOWED_DIFFERENCES variant elsewhere).

**Required before re-submission:** (1) split matcher hardening out or fix truth #7 + verify; (2) redesign the anchor/walk so a forged nearer root under an allowlisted prefix cannot shadow the real root (outermost-marker, or refuse roots under writable prefixes, or a non-writable anchor) + a both-markers spoof test arm; (3) enumerate the arms-3/4 rework; (4) produce a real marker-walk spike that plants a spoof and observes deny. Then re-validate.

---

## Validation verdict — round 2 (split 6c/6d, design B, 2026-07-12)

**6d: READY** (contingent on 6c landing first; dep enforces order). Tolerant verify honest, matcher delta byte-scoped to all three projections, no new ALLOWED_DIFFERENCES. No blocker.

**6c: NOT READY — one NEW spike-proven BLOCKER.** B1 (byte-identity) and B2 (arms 3/4) are genuinely CLOSED; B3's *below-root* spoof is closed by the outermost walk. But:

**S1 — the outermost walk trades a below-root spoof for an ABOVE-root spoof (spike `.spikes/codex-runtime-parity/aboveroot-plant.sh`, real guard).**
- The real guard ALLOWS out-of-repo absolute writes: `toRelPath` returns null on escape and the Edit/Write branch only acts `if (rel)` (`bee-write-guard.mjs:211-214`) → an untrusted agent can create files ABOVE the real root. (apply_patch denies-on-unprovable, but plain Write/Edit escape-allows — the asymmetry is the enabler.)
- With both markers planted at the repo's PARENT, the outermost (shallowest) walk selects the attacker root; the transport execs the attacker's `exit(0)` guard *script*; a gated Write to the real `.bee/state.json` returns exit 0 = BYPASS. `--repo-root` cannot help — the guard script itself loads from the attacker root.
- Nearest-ancestor was exploitable downward; outermost is exploitable upward. The spoof class is **moved, not closed**. must_have truth #3 ("the planted spoofed guard never runs") is false as written.

**Pattern:** two validation cycles, two spike-proven holes. Root cause = the transport resolves the guard *script's location* by walking from an untrusted cwd, and the guard does not prevent the attacker planting marker+script files on either side. Any walk direction from untrusted cwd has a spoof direction.

**Options for round-3 planning (a user risk call — D2 says hooks are explicitly NOT "a complete security boundary"):**
1. **Harden the guard (causal close):** outermost walk + the guard DENIES out-of-repo / marker-forging writes so the above-root plant can never be created. Bigger — a guard behavior change with blast radius (must not break legit out-of-repo writes; narrow to the marker files or gated paths). Add an above-root route arm; rescope truth #3.
2. **Trusted anchor (research first):** does Codex hand hooks a trusted project-root (env var or guaranteed cwd)? If so, drop the walk entirely — no walk, no spoof. Unresolved; needs an L1 check of the Codex hooks contract.
3. **Accept a bounded guarantee (D2-consistent):** ship outermost-walk (below-root closed), rescope truth #3 to below-root, document the above-root residual as relying on the deployment's write sandbox to bound the agent to the repo, file the hardening as a follow-on.

**Also (non-blocking, fold in):** name the `--source=repo$` anchor + exit-0 couplings in the `codex-repo-target-transport` row split (FEAS-WARNING); require BOTH markers in `--repo-root` validation (SEC-WARNING).
