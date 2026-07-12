# cli-mutations-3 — prose sweep: route every mutation instruction through the CLIs

**Status:** [DONE]

**Outcome:** Grep-driven sweep (`grep -rn 'state.json' skills/*/SKILL.md
skills/bee-hive/templates/AGENTS.block.md`; same for `backlog.jsonl`) found
9 lines instructing an agent to hand-edit `.bee/state.json` or
`.bee/backlog.jsonl` with no CLI verb, across bee-bypass-gate,
bee-compounding (x2), bee-exploring, bee-swarming, bee-planning,
bee-scribing, bee-reviewing (x3), bee-grooming, and bee-validating. Each was
replaced with the exact `bee_state.mjs`/`bee_backlog.mjs` verb and flags from
cli-mutations-1/-2 (`set`, `gate`, `worker add`, `scribing-run`,
`backlog add`). Added a standing rule to bee-hive `SKILL.md`'s Priority
Rules (hive law): "Never hand-edit `.bee/*.json(l)`... A mutation with no CLI
verb is filed as friction via `bee_backlog.mjs add`, then (only then) edited
by hand." Read-only mentions of `state.json`/`backlog.jsonl` (14 remaining
hits — file-listing tables, red-flag prose, "never edits" negatives) were
left untouched, per the cell's must_haves. `skills/bee-hive/templates/AGENTS.block.md`
was reserved and grepped but needed no edit — its four hits are all
read-only. Cell verify passed: no anti-pattern grep matches remain, and the
standing rule is present.

**Files touched:**
- `skills/bee-hive/SKILL.md`
- `skills/bee-bypass-gate/SKILL.md`
- `skills/bee-compounding/SKILL.md`
- `skills/bee-exploring/SKILL.md`
- `skills/bee-swarming/SKILL.md`
- `skills/bee-planning/SKILL.md`
- `skills/bee-scribing/SKILL.md`
- `skills/bee-reviewing/SKILL.md`
- `skills/bee-grooming/SKILL.md`
- `skills/bee-validating/SKILL.md`

Full trace/evidence: `.bee/cells/cli-mutations-3.json`
