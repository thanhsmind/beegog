# Review — Codex repo-fallback incident slice (6a + 6b)

**Feature:** `codex-runtime-parity` · **Cells:** codex-parity-6a (f0860ac), 6b (7499a71)
**Lane:** high-risk (no bypass) · **Date:** 2026-07-12
**Reviewers (review slot, opus):** code-quality · security · test-coverage · architecture+api-contract
**Verdict:** **P1 > 0 — merge blocked.** Two reproduced P1s (one fix cell), one P2-that-becomes-P1-if-a-live-Codex-check-fails (Gate-4 UAT).

---

## Gates (fresh)

`test_lib` **169/0** · `test_onboard` **PASS (0 failures)** · hook contract suite **119 rows, 0 skipped, 0 failing**.

## Verification-evidence gate

6a (`behavior_change: true`) carries real `red_failure_evidence` (MODULE_NOT_FOUND repro), `verify_passed: true`, substantive `outcome`, 2 recorded deviations. **PASS.** 6b is test-only (`behavior_change: false`). Frozen judge: **intact** on both (orchestrator-verified).

## Artifact verification

| Artifact | EXISTS | SUBSTANTIVE | WIRED |
|---|---|---|---|
| `catalog.mjs` repo-target renderer | ✓ | ✓ | ✓ — `.codex/hooks.json` byte-identical to `renderProjectionText("codex",{target:"repo"})` |
| `.codex/hooks.json` regenerated | ✓ | ✓ (9 cmds, 0 CLAUDE_PROJECT_DIR) | ✓ — live-fired: incident gone |
| route harness | ✓ | ✓ (RED@ref=39 real crashes, GREEN@active) | ✓ — bound into default suite (73→119 rows) |

Both existing projections (`hooks/hooks.json`, `hooks/claude-hooks.json`) render byte-identically — `plugin` default preserved.

---

## P1 — block merge (both closed by ONE fix cell)

### P1-a — PreToolUse write-guard fails OPEN; the guarded agent flips it off with one command
`git config core.bare true` → `git rev-parse --show-toplevel` exits 128 → `$r` empty → transport's fail-open arm exits 0 = **ALLOW**. The guard does not intercept `git config` (zero write targets). **Reproduced end-to-end.** bee's gate/reservation enforcement on Codex becomes a self-service kill switch for the untrusted party, no privilege escalation.

### P1-b — nested git root → MODULE_NOT_FOUND → guard silently OFF (corroborated ×2: security + code-quality)
Transport bails only when `$r` is *empty*. A cwd inside a *different* git root (submodule, vendored repo, `.spikes/` scratch repo) → `rev-parse` succeeds, `$r` non-empty, fail-open arm skipped, `exec node "$r"/hooks/bee-write-guard.mjs` dies exit 1 → Codex treats exit 1 as non-blocking → write proceeds. **The original incident's failure mode, one layer up.** The harness can't see it (fixture always copies `hooks/` to the root).

**Shared fix (new cell codex-parity-6c):** thread `event` into `commandFor`; for the **PreToolUse** entry fail **CLOSED** —
```sh
r="$(git rev-parse --show-toplevel 2>/dev/null)"
[ -n "$r" ] && [ -f "$r/hooks/bee-write-guard.mjs" ] || {
  echo "bee write guard: cannot resolve repo root — refusing write" >&2; exit 2; }
exec node "$r"/hooks/bee-write-guard.mjs --source=repo
```
Advisory events (SessionStart/UserPromptSubmit/PostToolUse/SubagentStop/PreCompact/Stop) keep exit 0 + the visible pinned diagnostic (R4). Fold in the P3 injection-hardening (quote the echo arg, validate script name). Regeneration re-invalidates `trusted_hash` → Gate-4 re-trust. Also amend spec R2/B6: *a deny-capable checkpoint fails CLOSED when its transport cannot start — "unknown" is not "safe" for a deny hook.*

---

## P2 → **P1 if the Gate-4 live check fails** (corroborated ×2: code-quality + architecture)

**The PreToolUse matcher `Edit|Write|MultiEdit|Bash|Read|Glob|Grep` does not match Codex's `apply_patch`.** `new RegExp(matcher).test("apply_patch") === false` (verified). The route harness executes command *strings* but never evaluates the matcher, so it cannot see this. If Codex regex-matches `tool_name` the way Claude does, the write-guard/apply_patch-deny contract — the **headline safety guarantee of the whole slice** — never fires on Codex, and 6b stays green asserting protection that doesn't exist. discovery.md:49-50 names this exact "Local" gap; cell-4 proved apply_patch deny only by *direct child spawn*, never through the real Codex matcher.

**Pre-existing** (matcher identical across pre-fix ref / plugin / codex — not a regression), but it decides whether the slice's safety claim is true. **Unprovable from the repo** → **Gate-4 UAT item**: the human runs a real Codex `apply_patch` against `.bee/state.json` in a trusted session and observes deny (exit 2). Fires → P2 (add a matcher-assertion route row). Does not fire → **P1**, and the codex matcher must include `apply_patch|shell` as an allowed per-runtime difference.

---

## P2 — real gaps, non-blocking (filed to backlog)

- **Renderer hardcodes `$r/hooks/`** — onboarding can't adopt it "unchanged"; a host `.codex/hooks.json` rendered as-is dies (host wrappers live in `.bee/bin/hooks/`). Correct the approach.md/catalog.mjs claim now; parameterize wrapper-dir in Distribution.
- **Claude↔Codex skew widened in bee's own repo** — Codex now runs current guarded wrappers; Claude still runs stale pre-adapter vendored ones (no apply_patch path). Re-vendor, or record as a spec gap.
- **`commandWindows` omitted + spec Open Gaps silent on Windows/non-POSIX `$SHELL`** — undeclared, not merely deferred. One-line spec fix.

## P3 — polish (filed, batch)

magic-`9` count · `genericRow` drops `skip` (plugin-census false green) · loose `expectApplyPatchDenied` · `codex-repo-target-transport` not in required list · `routeExpectation` TDZ ordering · no `--write` regen path · live-state hash race · state-sync arms prove only exit 0 · unquoted `echo`/unvalidated script name (folded into 6c).

---

## What is sound (checked, no finding)

`renderProjection` signature backward-compatible (options obj, `plugin` default, no positional-2 caller, `catalog.mjs` not vendored) · `--source=repo` safe on every wrapper (adapter tolerates unknown) · required-row manifest is config-derived and genuinely bites (RED/GREEN both proven honest) · no pre-existing assertion weakened/deleted/skipped · RED sensitivity is real crashes, not synthesized.

---

## Disposition

The fix **works** — the incident is dead, proven by live-fire. But the transport made an in-repo *deny* control depend on out-of-repo state (git resolvability), opening two reproduced bypasses, and the matcher may mean the deny never routes on Codex at all. **One fix cell (6c) + one Gate-4 UAT observation** settle all of it. No rework; no locked decision disturbed.
