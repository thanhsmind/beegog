# validating probe — flag syntax (V2)

Date: 2026-07-19 · codex-cli 0.144.4 · isolated CODEX_HOME:
`.bee/spikes/codex-native-transport/codex-home/` (D4-compliant — user config untouched).

## Observed

Form A — `[features]` / `multi_agent_v2 = true`:

```
multi_agent_v2    under development  true
```

Form B — `[features.multi_agent_v2]` table / `enabled = true` +
`hide_spawn_agent_metadata = false`:

```
multi_agent_v2    under development  true
```

Both forms parse without error/warning (`codex features list` exit 0) and flip the flag to
enabled on 0.144.4. The "under development" label stays (it is the flag's maturity stage,
not its state). Whether `hide_spawn_agent_metadata` is honored as a sub-key is NOT
observable from `features list` — that is V3 territory.

## Verdict

- **V2 answered:** the canary probe leg (cnt-5) can use either syntax; prefer form B (the
  table form Codex-Orchestration writes) since it carries the metadata sub-key.
- **V1, V3 remain open** — they need a real model turn attempting an override spawn;
  that observation is cnt-5's deliverable by design (either answer is a valid green).
