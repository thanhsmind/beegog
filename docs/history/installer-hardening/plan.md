# installer-hardening — plan

Mode: **standard** (flags: cross-platform, public install contract, existing covered behavior). CONTEXT.md D1-D7 are the law.

## Work shape

Five build cells + one acceptance cell. Core onboarding changes first (ih-1, ih-2 — parallel-safe, different concerns but same file: serialize via deps), then the two install scripts (parallel), docs, then airemote acceptance.

### ih-1 — CLAUDE.md becomes a default onboarding artifact (D1)
- `onboard_bee.mjs`: `claudeMd` defaults **true**; add `--no-claude-md`; keep `--claude-md` as accepted no-op alias; usage string updated.
- Existing create/append logic (lines ~1364-1373) unchanged — only the default flips. Idempotency: an existing CLAUDE.md with `@AGENTS.md` import stays untouched (plan reports nothing).
- Tests (`test_onboard_bee.mjs`): fresh onboard creates CLAUDE.md with import; existing CLAUDE.md without import gets append; with import → no plan item; `--no-claude-md` → no CLAUDE.md.
- Verify: `node skills/bee-hive/scripts/test_onboard_bee.mjs`

### ih-2 — per-project skill sync (D2, D3, D6) — the meaty one
- `onboard_bee.mjs`: skill-sync stage gains **two repo-relative target roots**: `<repo>/.claude/skills` and `<repo>/.agents/skills`. `computeSkillItems(sourceRoot, targetRoot)` is already root-parameterized — run it per target; plan items must carry which root they belong to (extend `scope` or add `target`; keep the D2 forced-apply transparency contract intact for every root).
- `--global-skills` flag restores the old single global target (`~/.claude/skills`); without it the global root is untouched (never deleted).
- Overlap-guard rework: repo-contains-target is now **by design** for the two in-repo roots — the guard must not refuse it. Keep refusing fail-closed when: repo root IS inside the global managed target; source and an in-repo target overlap (i.e. the source checkout onboarding **itself** — beegog: `realSource` inside `realRepo` → per-project sync is a **noop**, global sync stays available, current self-onboard behavior preserved).
- Version preflight (three-version D3 check) runs per target root; `unknown` semantics unchanged.
- `.gitignore` in host repos: per D4 the trees are committed — onboarding must NOT gitignore them (and must not add ignore entries).
- Tests: fresh host onboard populates both in-repo roots (15 bee-*); re-run is `up_to_date`; drift in one root shows `sync_skill` for that root only; `--global-skills` targets the home root; source-checkout self-onboard skips per-project sync; overlap guard still refuses repo-inside-global-target.
- Verify: `node skills/bee-hive/scripts/test_onboard_bee.mjs && node skills/bee-hive/templates/tests/test_lib.mjs`
- Deps: after ih-1 (same file — no parallel edits).

### ih-3 — install.sh follows the new defaults
- Layer-1 global copy step becomes conditional on `--global-skills`; default path relies on onboarding's per-project sync (layer 2).
- Drop the default `--claude-md` pass-through (now default in onboarding); add `--no-claude-md` pass-through.
- Help text + safety notes updated. Verify: `bash -n scripts/install.sh` + a `--dry-run --source . -d <tmp>` smoke that shows per-project plan items and no global copy.
- Deps: ih-2.

### ih-4 — install.ps1: same flags + ASCII-only rewrite (D5)
- Apply the same flag/flow changes as ih-3 (`-GlobalSkills`, `-NoClaudeMd`, no default global copy).
- Replace every non-ASCII character (six em-dashes) with ASCII (`-` or rewording). File stays UTF-8 (pure ASCII bytes).
- Add encoding regression guard to the test suite: fail if any `scripts/*.ps1` byte > 0x7F (runs on any platform, no pwsh needed).
- Verify: encoding test green + (this machine) `powershell.exe` `Parser::ParseFile` reports zero errors.
- Deps: ih-2 (flag semantics), parallel with ih-3.

### ih-5 — docs (INSTALL.md, bee-hive SKILL.md onboarding section)
- INSTALL.md: per-project layout is the documented default for both runtimes (`.claude/skills`, `.agents/skills`); global route moved under an opt-in section; codex section corrected (`.agents/skills` repo-level, `~/.codex/skills` legacy); troubleshooting row for the PS 5.1 encoding symptom.
- bee-hive SKILL.md onboarding bullets: mention the two in-repo targets and `--global-skills`.
- Verify: docs lane format check (markdown renders, no broken relative links).
- Deps: ih-3, ih-4.

### ih-6 — acceptance on airemote (D7)
- Re-onboard `/home/thanhsmind/projects/goglbe/airemote` with the new script (`--source` this checkout).
- Checklist: CLAUDE.md exists with `@AGENTS.md`; `.claude/skills` and `.agents/skills` each hold 15 `bee-*` dirs; `codex debug prompt-input` in airemote lists bee skills from the **repo** path; `node .bee/bin/bee_status.mjs --json` healthy; re-run reports `up_to_date`; `powershell.exe` parse check on install.ps1 → zero errors.
- Deps: ih-1..ih-5.

## Plan-check amendments (validated 2026-07-14)

- **ih-1 is a four-site edit, not one:** `claudeMd` default lives in `parseArgs` init (:1678), `computePlan` destructure (:1248), `applyPlan` destructure (:1467), plus the usage string (:1700). Flip all in lockstep. Existing CLAUDE.md tests (:584-601) only cover the explicit flag — add default-path and `--no-claude-md` cases.
- **ih-2's real cost is `computeSkillSync` (:565-731), not `computeSkillItems`:** identity check, overlap guard, and three-version preflight are baked into that one un-parameterized function (targetRoot hardcoded at :567). Parameterize it per target and turn the FOUR singular `skills` payload sites (plan :1788-1798, blocked-apply :1827-1833, applied :1862, recheck_skills :1859-1861) into a per-target collection (`skills.targets: [{kind, target_root, mode, blocked, versions, items}]`). Contracts that must survive per-target: D2 forced-apply transparency (items listed per target before any force), D5 recheck blocked-first precedence aggregated across ALL targets, `unknown`-version refusal semantics per target. `scope` consumers are only SKILL.md docs + test block 10z — additive extension is safe.
- **Self-onboard noop rule (new logic, crisp form):** per-project targets are skipped iff `realpath(sourceRoot)` equals or is inside `realRepo` — i.e. the repo being onboarded contains the RUNNING script's own skill tree (beegog case). A host repo that merely vendors a `skills/` dir never trips this because onboarding always runs from the bee source checkout/global install, whose sourceRoot is external.
- **In-repo overlap exemption:** guard at :603-626 currently refuses `realTarget.startsWith(realRepo + sep)` — exempt exactly the two managed in-repo roots; keep every other refusal (repo inside global target, source/target overlap) intact with tests.
- **ih-5 scope grows:** README.md :367 and :428 assert global-only sync; bee-hive SKILL.md :31 ("Every --apply also syncs the global bee skill set") — all three must be rewritten with the per-project story. Historical decision docs stay as-is (history, not current claims).

## Risks / watchpoints
- Overlap-guard rework is the riskiest edit (fail-closed logic, review P1-4 heritage) — keep every existing refusal test green; only *add* the in-repo exemption.
- Plan-item `scope` extension must not break consumers (SKILL.md documents `scope: installed|source`; hooks/UI may read it) — extend additively.
- install.ps1 edits must be verified byte-level ASCII post-edit (editor could reintroduce unicode punctuation).
- airemote has real state (`.bee/decisions.jsonl` etc.) — onboarding never overwrites state; acceptance must diff-check nothing outside managed paths changed.
