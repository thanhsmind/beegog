# PUBLIC-CONTRACT Review — 088fcd8..HEAD (codex-runtime-parity slice)

Scope: git diff `088fcd8..HEAD` + `docs/history/codex-runtime-parity/CONTEXT.md`. Read-only.
Focus: hook-catalog routing split, Codex default route, `bee_state start-feature`, adapter vendoring.

Findings: 5 total — P1: 0 · P2: 1 · P3: 4

---

## P2-1 — `.codex/hooks.json` project fallback now diverges from the parity'd plugin route
- **severity:** P2
- **autofix_class:** regenerate-or-remove (mechanical, but human-gated: deletes committed config)
- **summary:** The committed OLD Codex project fallback `.codex/hooks.json` was NOT touched by this diff. It still wires every wrapper through `node "$CLAUDE_PROJECT_DIR"/.bee/bin/hooks/bee-*.mjs`, i.e. the pre-parity vendored wrappers — none of the D2 fixes shipped in this slice (hostile-stdin normalization, JSON `systemMessage` advisories, `apply_patch` write guarding). The new plugin Codex route (`hooks/hooks.json`, rendered from `hooks/catalog.mjs`, backed by the adapter) got all of them.
- **today-behavior:** Two Codex routes exist. The plugin default route (`hooks/hooks.json`) is fully parity'd. The project fallback (`.codex/hooks.json`) silently runs the old, unguarded wrappers, and per `docs/history/codex-runtime-parity/reports/intake-audit.md` P1 is effectively inert because `$CLAUDE_PROJECT_DIR` is unset in Codex (path resolves outside the repo).
- **failure scenario:** A Codex installation that relies on the project fallback (the documented dogfood route, D1) gets zero of the release's advertised Codex enforcement: a top-level `null` payload crashes 6/7 wrappers instead of failing open; `apply_patch` writes to `.bee/state.json` are never gated; advisories emit unparseable prose. The plan's own `approach.md:34` and `implement-plan.md:147` say to *remove* this file and have onboarding generate an explicit fallback — that removal did not land in this slice, so the stale file still ships.
- **file:line:** `.codex/hooks.json` (entire file; unchanged in range — `git diff --stat 088fcd8..HEAD -- .codex/` is empty)
- **smallest fix:** Execute the planned removal now (delete `.codex/hooks.json`) OR, if it must stay as a fallback this release, re-vendor `.bee/bin/hooks/` from the new `hooks/*.mjs` + `adapter.mjs` and swap `$CLAUDE_PROJECT_DIR` for a Codex-resolvable root so the fallback carries the same parity. Do not leave the pre-parity file as active committed config.
- **caveat:** Pre-existing brokenness (file was already inert before this diff); flagged because it is now *contradictory* with the parity'd plugin route and the release advertises Codex parity. Landing target is the Distribution slice per CONTEXT deferred-to-planning.

---

## P3-1 — `docs/07-contracts.md` calls `hooks/hooks.json` the Claude Code plugin hook config
- **severity:** P3 (docs-only)
- **autofix_class:** doc-edit
- **summary:** After the catalog inversion, `hooks/hooks.json` is the CODEX default projection and `hooks/claude-hooks.json` is the Claude projection wired by `.claude-plugin/plugin.json`. The contracts doc still names `hooks/hooks.json` as "Claude Code plugin hook config".
- **today-behavior:** Contract doc describes the wrong file as Claude's hook source.
- **failure scenario:** A consumer reading the contract doc edits/points at `hooks/hooks.json` expecting to change Claude wiring; Claude actually loads `hooks/claude-hooks.json`, so the change has no effect on Claude (and silently alters the Codex projection).
- **file:line:** `docs/07-contracts.md:178`
- **smallest fix:** Change the line to name `hooks/claude-hooks.json` as the Claude plugin config and note `hooks/hooks.json` is the Codex default projection (both rendered from `hooks/catalog.mjs`).

## P3-2 — Stale hook count / filename in runtime + install docs
- **severity:** P3 (docs-only)
- **autofix_class:** doc-edit
- **summary:** Docs still say "six scripts, six events" and reference `hooks/hooks.json` as the single skeleton. There are now seven wrappers (model-guard added earlier) plus the shared `adapter.mjs`, and Claude vs Codex use split projection files.
- **today-behavior:** Undercounts hooks and names the pre-inversion single file.
- **failure scenario:** An integrator provisioning hooks by hand from the docs omits `bee-model-guard.mjs`/`adapter.mjs` or wires the wrong projection.
- **file:line:** `docs/06-runtime-integration.md:24`; `INSTALL.md:61`
- **smallest fix:** Update counts to seven wrappers + adapter and reference the two projections (`hooks/hooks.json` Codex default, `hooks/claude-hooks.json` Claude).

## P3-3 — Plugin manifest version drift (Codex manifest not bumped with parity work)
- **severity:** P3
- **autofix_class:** version-sync (Distribution slice)
- **summary:** `.claude-plugin/plugin.json` is `0.1.22`; `.codex-plugin/plugin.json` is `0.1.18` and was untouched by this diff even though the Codex runtime just changed materially.
- **today-behavior:** The two manifests a marketplace consumer sees disagree on version; the Codex manifest advertises a version that predates the parity fixes.
- **failure scenario:** A marketplace/host pinning or diffing plugin versions treats the Codex plugin as unchanged and skips re-onboarding, missing the parity wrappers.
- **file:line:** `.codex-plugin/plugin.json` (`"version": "0.1.18"`) vs `.claude-plugin/plugin.json:2` (`0.1.22`)
- **smallest fix:** Out of scope for this slice by design (`hooks/catalog.mjs:26-28` and CONTEXT defer version-parity to the Distribution slice). Ensure the Distribution slice bumps both manifests together and adds the drift guard.

## P3-4 — This repo's vendored `.bee/bin/hooks/` is stale relative to the rewritten plugin hooks
- **severity:** P3 (dogfood drift, not a shipped host contract)
- **autofix_class:** re-vendor (`onboard_bee.mjs --repo-hooks`)
- **summary:** `hooks/*.mjs` were rewritten to import `./adapter.mjs`; the repo's own `.bee/bin/hooks/` copies are the pre-parity wrappers (dated Jul 10/11) and contain no `adapter.mjs`. The bee repo's `.claude/settings.json` and `.codex/hooks.json` both point at `.bee/bin/hooks/`, so any dogfood repo-fallback run executes the old, unguarded wrappers.
- **today-behavior:** Repo-fallback in the bee repo runs pre-parity hooks. (Host repos are safe: `onboard_bee.mjs` `HOOK_FILENAMES` now includes `adapter.mjs` and `copy_repo_hook` re-copies all wrappers + adapter on re-onboard — the codex-parity-3 deviation correctly closes the vendoring gap.)
- **failure scenario:** Anyone treating the bee repo's `.bee/bin/hooks/` as the current wrapper set (or dogfooding through it) sees old behavior and no `adapter.mjs`.
- **file:line:** `.bee/bin/hooks/` (whole dir; no `adapter.mjs`, wrappers older than `hooks/*.mjs`)
- **smallest fix:** Re-run `node skills/bee-hive/scripts/onboard_bee.mjs --repo-hooks` in the bee repo to refresh `.bee/bin/hooks/` and drop in `adapter.mjs`.

## P3-5 — `bee_state.mjs` hard-imports `startFeature`; a mismatched vendored `lib/state.mjs` breaks every state verb
- **severity:** P3 (backward-compat coupling; low probability)
- **autofix_class:** none / vendoring-order note
- **summary:** `bee_state.mjs` adds `import { startFeature } from './lib/state.mjs'` (line 72). ESM named-import resolution is eager: if a host has a NEW `bee_state.mjs` but an OLDER vendored `lib/state.mjs` that lacks the `startFeature` export (a partial/interrupted re-vendor), the module fails to load and EVERY verb (`set`/`gate`/`worker`/`scribing-run`) breaks, not just `start-feature`.
- **today-behavior:** Fine when both files are vendored together — `onboard_bee.mjs` copies helpers and libs in the same run and the hash manifest re-check catches drift. Verified: `start-feature` itself is convention-clean — routed through the shared `main()` harness (exit 1 + `{error}` on `--json`, exit 0 on success like siblings), uses `requireFlag`, validates `phase` via `isKnownPhase`, and writes only existing state fields (`approved_gates` keys match `GATE_NAMES = ['context','shape','execution','review']`), so an older reader never chokes on the state.json shape.
- **failure scenario:** A host updates `.bee/bin/bee_state.mjs` alone (manual copy, aborted onboard) and leaves an old `lib/state.mjs` → all state operations hard-fail at module load with "does not provide an export named 'startFeature'".
- **file:line:** `.bee/bin/bee_state.mjs:72` (import); `.bee/bin/lib/state.mjs:136` (export). Template parity confirmed: `skills/bee-hive/templates/bee_state.mjs` + `templates/lib/state.mjs` carry the same additions.
- **smallest fix:** No code change required; keep the invariant that `bee_state.mjs` and `lib/state.mjs` are always vendored as a pair (already true in `onboard_bee.mjs`). Optionally note the coupling near the import so a future manual copy doesn't split them.

---

## Verified clean (no finding)
- **Q1 live consumers:** No live (non-doc, non-test) consumer still points Claude at `hooks/hooks.json`. `.claude-plugin/plugin.json` → `./hooks/claude-hooks.json`; `onboard_bee.mjs` `renderRepoHookEntries()` renders the Claude shape independently (includes the Claude-only `Agent|Task` model-guard entry); `test_onboard_bee.mjs` and `test_hook_contracts.mjs` compare against the correct projection files.
- **Q2 marketplace arrangement:** `.codex-plugin/plugin.json` carries no `hooks` override and `hooks/hooks.json` exists at plugin root — exactly what the codex-acceptance test rows assert (`test_hook_contracts.mjs:692,700`). Consistent with the validator.
- **Q4 adapter vendoring:** `onboard_bee.mjs` `HOOK_FILENAMES` (line 49) lists `adapter.mjs`; `listPluginHooks()` → `copy_repo_hook` copies it into `.bee/bin/hooks/` wherever wrappers land. No other per-file copy mechanism ships wrappers (the deep-mirror mirrors `skills/`, not `hooks/`; the plugin package ships `hooks/` wholesale). Vendoring path is covered.
