# CONTEXT — skill-sync

## Boundary

Bee's update flow must update the **full skill set by script**, replacing today's manual
copy: one `onboard_bee.mjs --apply` run leaves vendored helpers AND the installed bee skills
consistent at the same version, with drift visible in the dry-run plan. Out of boundary:
plugin marketplaces, non-bee skills, per-project skill installs (deferred).

Origin: owner instruction 2026-07-11 ("cơ chế script của bee chạy là cập nhật đầy đủ skill,
chứ không phải copy lên như hiện tại"), immediately after two manual-copy failures the same
day: (a) `~/.claude/skills` had drifted far behind the repo (missing `bee-evolving`, stale
swarming/review protocols) until hand-rsynced; (b) a stale 0.1.18 plugin's onboard apply
overwrote committed 0.1.19 vendored helpers (regression fixed in 5437f82).

## Domain types

- **RUN** — the onboarding script's apply pipeline gains a skill-sync stage.
- **CALL** — `onboard_bee.mjs` CLI surface: plan output items, `--force-downgrade` flag.
- **ORGANIZE** — layout/mirroring of `~/.claude/skills/bee-*` from the bee repo `skills/`.

## Locked decisions

| ID | Decision | Why |
|---|---|---|
| D1 | Sync target is the **global** `~/.claude/skills` only — no per-project skill installs | Matches reality: every project shares the global set; host repos carry no local bee skills (checked: anphabe-crm `.claude/skills` has 0 bee skills). One drift source. Per-project pinning deferred until a real need exists |
| D2 | Skill sync runs **automatically inside every `onboard_bee.mjs --apply`**, and skill drift appears as plan items in the `--json` dry-run. **Source discovery is deterministic**: the source is the skill tree the running script belongs to — a bee source repo (`skills/bee-*` sibling layout) syncs to the global install; when the script runs from the installed copy itself (`~/.claude/skills/bee-hive/scripts/…`, source root = target root) the skill stage is a **verify-only NOOP**; when no authoritative source resolves, the whole apply **fails closed at preflight** (see D3 — zero mutations). **Authoritative = the tree the running script itself belongs to, anchored on its own `bee-hive`** — within an anchored source, an absent `bee-*` skill IS an intentional removal (D4 mirrors it); a tree the script does not belong to is never guessed at | The failure class was exactly "helpers updated, skills not" (and its reverse). One command = everything consistent; no manual step left to forget. Fresh-eyes finding 2: host-repo onboarding normally runs from the installed copy — self-mirroring or guessing a source there must be impossible by definition |
| D3 | **Downgrade guard, refuse by default, as one preflight**: BEFORE any write, apply resolves all three versions — source, the host repo's vendored helpers, the global installed skills — and **refuses iff source < host-helpers OR source < installed-skills** (an unresolvable version counts as a refusal, reported as unknown — **validating clarification, presented at Gate 3:** ABSENT is not unresolvable: a target/skill-tree that does not exist at all is a **fresh install** and proceeds; refusal covers only a tree that EXISTS but whose version cannot be read — unreadable/unparsable/corrupt. Same rule for the host side: a repo with no vendored `.bee/bin/lib/state.mjs` is a first onboard, not a refusal); refusal or source-resolution failure aborts the ENTIRE apply at preflight, exits nonzero, **zero mutations anywhere** (repo or global), message reports all three versions; `--force-downgrade` overrides ONLY a refusal in which all three versions resolved numeric; an `unknown` refusal (existing-but-unreadable tree) and `blocked_no_source` are resolution failures and are NEVER forceable. Compatibility boundary: the guard protects from the first guarded version onward — older launchers predate the guard and cannot be retro-protected | A silent downgrade is the exact defect that bit the same day (0.1.18 plugin over 0.1.19 helpers). Round-2 fresh-eyes: three versions exist, so the refusal predicate is spelled out; preflight covers fail-closed too, so nothing lands half-applied |
| D4 | **Mirror semantics within the `bee-*` namespace only**: skills and files removed from source are removed from the install; skills outside `bee-*` are NEVER touched | A deleted/renamed skill must not remain loadable (zombie ceremony); the namespace fence protects the user's other skills (agent-browser, cloudflare, …) absolutely |
| D5 | **Content difference IS drift, at any version**: with equal versions, any file-set or byte difference between source and installed `bee-*` skills is drift — it appears in the dry-run plan and apply mirrors it; the recheck verifies **content parity** (hashes), not version equality. Version comparison governs exactly one thing: the D3 downgrade refusal | Fresh-eyes finding 4: parity level is observable product policy, not an implementation detail. Version-only checking would re-create today's failure (equal-version stale copies) and contradict D2's drift visibility and D4's mirror |

## Scout paths

- `skills/bee-hive/scripts/onboard_bee.mjs` (772 lines) — plan/apply pipeline; today vendors
  `.bee/bin` helpers + AGENTS block + hooks; zero skill awareness. Plan-item vocabulary:
  `copy_helper`, `copy_lib`, `write_onboarding`, `merge_repo_hook_settings`.
- `skills/` — source of truth, 15 `bee-*` skill dirs (SKILL.md + references/ + scripts/ +
  templates/).
- `~/.claude/skills/` — install target; also hosts many non-bee skills (fence required).
- `skills/bee-hive/templates/lib/state.mjs` `BEE_VERSION` — the version constant;
  `.bee/onboarding.json` records per-repo vendored version. Note: no global marker exists
  today for the *installed skills* version — planning must pick the detection mechanism.
- `skills/bee-hive/scripts/test_onboard_bee.mjs` — the onboarding test suite new behavior
  must extend.

## Canonical references

- Decision aec38e11 (review-wave composition), decision 9d9591ca (external finish contract) —
  examples of the skill files being the operative contract that MUST reach the install to
  take effect: a skill change that never lands in `~/.claude/skills` is a no-op for every
  session.
- `.bee/backlog.jsonl` friction "onboard_bee.mjs apply has no downgrade guard" (2026-07-11,
  source 5437f82) — superseded by D3 when this ships.
- `docs/backlog.md` P19 row (in-flight, feature skill-sync).

## Open questions (for planning)

- Where the installed-skills version marker lives (read `BEE_VERSION` from the installed
  copy of `templates/lib/state.mjs`, or a dedicated marker file) — implementation choice.
  (Parity level and sync-on-diff are no longer open — locked as D5.)
- Exact CLI vocabulary for the new outcomes (dry-run status values beyond
  `up_to_date`/`changes_needed`, refusal exit code, JSON diagnostic fields) — planning
  designs it; the product constraints are already locked (distinct visible statuses for
  drift / downgrade-refusal / unavailable-source, nonzero exit on refusal, D3 predicate
  reported with all three versions). Round-2 fresh-eyes finding 4, deliberately left to
  planning.

## Deferred ideas

- Per-project `.claude/skills` pinning (rejected in D1 for now) — backlog if a repo ever
  needs a frozen skill version.
- Extending the same mechanism to non-skill global assets (keybindings, agents) — out of
  scope.
