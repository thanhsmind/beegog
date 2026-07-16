[DONE]

Defined the serialized opt-in worktree-dispatch contract, protected control-plane
attestation, consistency-only threat model, typed integration halts, and
non-authoritative worker result fields. The exact focused suite passes.

Files touched:

- `skills/bee-swarming/SKILL.md`
- `skills/bee-executing/references/worker-details.md`
- `skills/bee-hive/templates/tests/test_lib.mjs`

Full trace and evidence: [worktree-isolation-3](../../../../.bee/cells/worktree-isolation-3.json).

Commit note: this environment protects `.git` as read-only; the required atomic
commit was attempted after capping and remains for the writable integration host.
