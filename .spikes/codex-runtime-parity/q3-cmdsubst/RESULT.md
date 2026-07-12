# Spike Q3 — does Codex substitute `$( )` in a project hook command?

**Date:** 2026-07-12 · **Runtime:** codex-cli 0.144.1 · **Cell under validation:** codex-parity-6

## Question (one, yes/no)

Cell codex-parity-6 proposes repo-target hook commands that "resolve the git root".
The only transport that does that without Claude env vars is:

```
node "$(git rev-parse --show-toplevel)"/hooks/bee-<script>.mjs
```

That requires Codex to perform **command substitution** when it executes a hook
command. Does it?

## Answer

**UNPROVEN — and not provable from a non-interactive harness.** Do not build on it.

## Method

Isolated `CODEX_HOME` (never touches `~/.codex`), throwaway git repo, three
transports wired to the *same* `SessionStart` event so one run discriminates:

| Arm | Command | Purpose |
|---|---|---|
| `CONTROL-abspath` | `node /abs/path/probe.mjs` | needs no expansion — proves hooks fire at all |
| `TREATMENT-cmdsubst` | `node "$(git rev-parse --show-toplevel)"/probe.mjs` | the transport under test |
| `TREATMENT-envvar` | `node "$SPIKE_ROOT"/probe.mjs` | var expansion (known to work) |

Run via `codex exec` from a **nested** cwd (`proj/nested/deep`), which is the
condition the cell actually cares about.

## Result

**The `CONTROL` never fired.** Marker file empty across two runs. Since the control
needs no expansion at all, the treatments cannot be evaluated — the harness never
got hooks to execute, so this says nothing about `$( )` either way.

Run 1: no `[features]` flag → silent, exit 0, no diagnostic.
Run 2: with `[features] hooks = true` → still silent, exit 0, no diagnostic.

Remaining suspects, in order: (a) `codex exec` (non-interactive) does not run
`SessionStart`/`UserPromptSubmit` project hooks at all; (b) per-entry
`trusted_hash` gating is still refusing the hooks and `bypass_hook_trust` is not
a user-settable key. Settling this needs an **interactive-session** probe, not
more `codex exec`.

## What the spike DID prove (both load-bearing, neither in the plan)

### F1 — Codex hooks are gated behind an experimental feature flag

`~/.codex/config.toml` carries:

```toml
[features]
hooks = true
```

Without it, **no project hook runs at all** — silently, exit 0, no warning, no
diagnostic line. bee's entire Codex repo-fallback route is therefore conditional
on a flag that (i) nothing in `plan.md`, `CONTEXT.md`, `approach.md`, or
`docs/specs/hook-runtime.md` mentions, (ii) onboarding never sets or checks, and
(iii) a fresh user will not have.

Consequence: the slice's business rule "the installation has exactly one active
bee hook source" is **false by default on a clean machine** — it has *zero*. A
green install and a silently-dead install are indistinguishable today.

### F2 — hook trust is per-entry and hash-pinned (INFERENCE, not proof)

`[hooks.state."<abs path>/.codex/hooks.json:<event>:<group>:<idx>"] trusted_hash = "sha256:…"`

Nine such entries exist for this repo — one per hook, keyed by file path, event,
group and index, each pinned to a `sha256`.

**Honesty note:** I did NOT reverse-engineer the preimage. Hashing the command
string, the entry JSON (compact and pretty), `type+command`, and
`command+newline` all fail to reproduce `stop:0:0`'s `trusted_hash`. So the exact
input is unknown and I am labelling this an inference, not evidence.

The inference: a per-entry `trusted_hash` exists to detect hook *content* change,
so **rewriting `.codex/hooks.json` very likely invalidates all nine and forces a
re-trust**. If true, cell 6's "regenerate `.codex/hooks.json`" carries an
un-modelled human re-trust step, and the cell's own prohibition ("do not modify
trust/global configuration") collides with the fact that its edit *forces* a trust
change. This must be confirmed by the same interactive probe that settles Q3 —
it is exactly the kind of thing that turns a "green" cell into a dead hook source
on the user's machine.

## Verdict for Gate 3

`NOT READY - RETURN TO PLANNING`. The transport is unproven, and the two facts
above change the shape of the work rather than just its details.

## Reproduce

```
bash .spikes/codex-runtime-parity/q3-cmdsubst/run.sh
```
