# installer-hardening — CONTEXT

**Status:** locked (gate bypass: recommended choices recorded)
**Date:** 2026-07-14
**Trigger:** owner report — fresh installs missing CLAUDE.md; skills land global-only; install.ps1 broken on Windows; Codex sessions don't pick up bee skills. Evaluate + test on goglbe/airemote.

## Evidence gathered (2026-07-14)

- **E1 — airemote onboard state:** has `AGENTS.md`, `.bee/`, `.claude/settings.json` (hooks) — **no `CLAUDE.md`**, no per-project skills. `--claude-md` is opt-in in `onboard_bee.mjs` (line ~1367) and install.sh/ps1 don't pass it by default.
- **E2 — install.ps1 is unparseable in Windows PowerShell 5.1.** Verified via `powershell.exe` + `Parser::ParseFile`: cascade of parse errors starting line 42/141. Root cause: the file contains em-dash `—` (lines 1, 6, 42, 147, 149, 166) and is UTF-8 **without BOM**; PS 5.1 reads it as cp1252, so `—` (E2 80 94) decodes as `â€` + 0x94 = `"` (U+201D), and PowerShell treats smart quotes as string delimiters → a string terminates mid-line and everything after is garbage. `$x = try {} catch {}` assignment is valid (tested, returns 1) — NOT the bug.
- **E3 — Codex skill discovery (codex-cli 0.144.3, docs at learn.chatgpt.com/docs/build-skills):** repo-level skills load from **`.agents/skills/`** (cwd, parents up to repo root); user-level from `~/.agents/skills`; `~/.codex/skills` still scanned (legacy — bee skills there DO appear in `codex debug prompt-input` on WSL). Repo-level `.codex/skills` is **not** a documented discovery path.
- **E4 — Claude Code discovery (code.claude.com/docs/en/skills):** project skills load from `.claude/skills/` (starting dir → repo root, nested dirs on demand); personal from `~/.claude/skills`. `.agents/skills` is NOT a Claude Code discovery path. Symlinked skill dirs are followed by both runtimes, but Windows symlinks need privileges → real copies are the portable choice.
- **E5 — "Codex doesn't understand bee" on the owner's Windows machine is consistent with E2:** the ps1 never ran, so no skills were ever installed there. On WSL codex lists all 15 bee skills.
- **E6 — onboard_bee.mjs already has the full D1-D5 skill-sync machinery** (`computeSkillItems(sourceRoot, targetRoot)`, alias/symlink guards, version preflight) parameterized by target root — currently hardwired to `~/.claude/skills` (`skillsTargetRoot()`, line 218). Skills payload ≈ 1.9 MB / 15 dirs.

## Locked decisions

- **D1 — CLAUDE.md is a default onboarding artifact.** `onboard_bee.mjs` writes/extends CLAUDE.md with the `@AGENTS.md` import **by default**; new opt-out flag `--no-claude-md`. `--claude-md` remains accepted (now a no-op alias of the default). install.sh / install.ps1 stop passing `--claude-md` and gain `--no-claude-md` / `-NoClaudeMd` pass-through. Existing CLAUDE.md content preserved byte-for-byte; import appended once (existing logic reused).
- **D2 — Per-project skill install is the default.** Onboarding syncs the bee skill set into the **host repo**: `<repo>/.claude/skills/bee-*` (Claude Code) and `<repo>/.agents/skills/bee-*` (Codex). Same D1-D5 sync machinery, target roots now repo-relative; the repo/target overlap guard is re-derived for in-repo targets (the repo *contains* the target by design — the guard must exempt the managed subdirs while still refusing when the repo root IS the skills source checkout, i.e. beegog itself never self-installs per-project copies over its own `skills/`).
- **D3 — Global install becomes opt-in.** New flag `--global-skills` (sh: `--global-skills`, ps1: `-GlobalSkills`) restores the old behavior (`~/.claude/skills`, `~/.codex/skills`). Existing global copies are never deleted by this change; drift against them is no longer managed once a repo goes per-project (surfaced as an INSTALL.md note).
- **D4 — Per-project skill trees are committed to the host repo** (same policy as vendored `.bee/bin` helpers): team members and CI get identical skills; refresh happens via re-onboard on version bump.
- **D5 — install.ps1 must parse in Windows PowerShell 5.1.** Fix: ASCII-only content (replace `—` and any non-ASCII); add a repo test that fails on non-ASCII bytes in `scripts/*.ps1` (encoding regression guard, runnable on any platform).
- **D6 — Codex bootstrap path is `.agents/skills` + AGENTS.md BEE block.** No `.codex/skills` repo dir (not a discovery path). `~/.codex/skills` legacy copy only under `--global-skills`. INSTALL.md rewritten to describe the per-project layout for both runtimes.
- **D7 — Acceptance = airemote.** Re-onboard `goglbe/airemote` with the new flow and verify: CLAUDE.md present with import; `.claude/skills` + `.agents/skills` populated (15 bee-*); `codex debug prompt-input` lists bee skills from the repo path; `node .bee/bin/bee_status.mjs` healthy; `powershell.exe` parse check on install.ps1 reports zero errors.

## Out of scope

- Deleting/migrating existing global skill installs on user machines.
- Codex plugin-manifest route (`.codex-plugin/plugin.json`) — unchanged.
- Claude Code plugin route — unchanged (still the recommended hook transport when available).
- anphabe host repos rollout (separate release step, owner's call per host).
