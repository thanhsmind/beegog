# ih-4 — install.ps1: PS 5.1 parse fix (ASCII-only) + flag parity + encoding guard test

[DONE] `scripts/install.ps1` is now ASCII-only (6 em-dashes replaced, PS 5.1 `Parser::ParseFile` reports zero errors) and has flag/flow parity with D1/D3: `-GlobalSkills` (opt-in, gates the layer-1 global copy that used to run unconditionally), `-NoClaudeMd` (`--no-claude-md` pass-through), `-ClaudeMd` kept as a compat no-op. Added a pure-node encoding regression guard (section 12) to `test_onboard_bee.mjs` that fails if any byte > 0x7F appears in `scripts/*.ps1`, self-tested against a planted scratch file outside the repo.

Files: `scripts/install.ps1`, `skills/bee-hive/scripts/test_onboard_bee.mjs`

Full trace/evidence: `.bee/cells/ih-4.json`
