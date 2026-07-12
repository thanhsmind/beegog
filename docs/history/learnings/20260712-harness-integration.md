---
date: 2026-07-12
feature: harness-integration
categories: [process, failure, security]
severity: mixed
tags: [vendoring, delegation-design, dual-parsers, fail-open-composition, manifest-contract, tier-selection]
---

# Learnings — Harness Integration Phase 1

## What Happened

Phase 1 shipped a unified CLI dispatcher (`bee.mjs`), a JSON-Schema manifest (`--help --json`), and a 4th write-guard check enforcing it — 4 cells, then a 5-reviewer wave found 3 P1s, 3 fix cells (5 more), and a re-review caught 1 more real gap before Gate 4 cleared. Two rounds of validating (iteration 1: 6 blockers) and reviewing (iteration 1: 3 P1s + 15 P2/P3) both found real defects that earlier stages missed — planning's own design, and even the 5-reviewer wave's first pass, were each individually insufficient; only the layered gates together caught everything.

## Root Cause (per theme)

1. **Planning assumed a delegation mechanism without tracing the actual export surface.** Cell 2's spec said `bee.mjs` would "delegate to the existing helpers' handlers" — but all 4 legacy CLI files export nothing; each self-executes on import against real argv. This wasn't caught until validating. The fix needed no new design: all 4 already delegate internally to `lib/*.mjs`, so `bee.mjs` became a 5th thin wrapper over the same exports — the answer was already in the codebase, unread.

2. **A hook change was verified at the source-file level but never checked against the live-enforcing vendored path.** `onboard_bee.mjs --apply` (no flag) vendors helpers/lib generically, but hooks require `--apply --repo-hooks` — a separate, easy-to-forget flag. `.claude/settings.json` wires this session's actual PreToolUse enforcement to `.bee/bin/hooks/bee-write-guard.mjs` (the vendored copy), not the source. Cell-3's new security check passed its own test suite (which spawns the source file directly) while being **completely inert in the live session** until incidentally discovered during an unrelated later fix.

3. **A "fixed" template file was re-vendored to the working tree but the vendored copy was never re-committed**, leaving HEAD internally inconsistent: `onboarding.json`'s recorded hash didn't match the actually-committed vendored file's content. Nothing mechanically checks source-vs-vendored-vs-committed consistency; only the re-review's habit of diffing committed content against the recorded hash (rather than trusting the local diff) caught it.

4. **Two independently-hand-written parsers for the same CLI-flag grammar diverged.** The write-guard hook's `parseCliFlags` and `bee.mjs`'s `parseFlags` both parse the same command strings but were written separately; they disagreed on whether a `--`-prefixed token following a flag is a value or a new flag. No test asserted the two agree.

5. **A manifest advertised as a "tested contract" was tested against the wrong surface.** `examples[]` used legacy-helper grammar while `invoke` used dispatcher grammar; concatenating them (as an agent naturally would) produced a broken double-positional call. The "every example runs" test executed against `entry.helper`, never `bee.mjs` — proving the contract on a surface the manifest doesn't actually describe.

6. **A drift-detection side effect was allowed to reshape the primary data contract.** `manifest_changed` nested a data command's real JSON result under `{manifest_changed, manifest_changed_hint, result}` on drift — an advisory, out-of-band signal was allowed to mutate the shape of the in-band data path it was riding alongside.

## Recommendations (imperative)

1. **Before designing a delegation/integration mechanism, trace what the target code actually exports/exposes — do not assume a callable surface exists.** If the target already has a thinner layer underneath (a shared lib, an internal API) that the direct target itself uses, delegate to that layer instead of the target.
2. **Any change to `hooks/*.mjs` must re-vendor with `onboard_bee.mjs --apply --repo-hooks` (not bare `--apply`) and verify the ACTUAL wired path in `.claude/settings.json` / `hooks/hooks.json` matches the vendored copy** — a hook's own test suite spawning the source file is not proof the live session enforces the fix.
3. **Before capping a cell that fixes a vendored/templated file, verify the committed vendored copy's content hash matches `onboarding.json`'s recorded hash** (`git show HEAD:<vendored-path> | sha256sum` vs. the recorded hash) — a working-tree fix is not a shipped fix until both the source and its vendored copy are committed and consistent.
4. **When two code paths independently reimplement the same parsing/decision logic (a CLI flag parser, a schema check, a format validator), add an explicit cross-agreement test from the moment the second implementation is written** — do not wait for a reviewer to notice the divergence.
5. **A "manifest is a tested contract" claim must be verified against the exact surface the manifest advertises** (the `invoke` path), not a convenient stand-in (a legacy helper, a mock).
6. **A side-channel/advisory signal (drift, staleness, versioning) must never alter the shape of the primary data path it accompanies** — route it to a separate channel (stderr, a discovery-only command, a header) instead of wrapping the real payload.
7. **When a configured tool/executor (a review tier, an external CLI) runs outside the enforcement mechanism currently being built or tested, do not use it for that work even if configured** — pick an equivalent that stays inside the boundary being validated, and disclose the substitution.

## Notable but not promoted

- Fail-open composition risk in `bee-write-guard.mjs`'s shared try/catch (a new check must be provably unable to clobber a prior denial) — fixed with an explicit must-have + forced-throw test; captured here as a pattern for any future extension to a shared-state gate, not promoted to critical-patterns.md since it's specific to this one file's structure.
- `cells.verify --passed` remains a (P2, non-blocking) divergence between the dispatcher's hardcoded boolean-flag list and the hook's schema-derived one — filed to backlog, same root family as recommendation 4 above but not itself fixed this feature.
