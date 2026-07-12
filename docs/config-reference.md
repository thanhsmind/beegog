# `.bee/config.json` — configuration reference

Every onboarded repo has a `.bee/config.json`. Any key you leave out uses a built-in default, so the file can be short — but the values below are the ones worth setting per repo. **`.bee/config.json` is strict JSON: no comments, no trailing commas.** The annotated block here is for reading; copy the clean block at the bottom into the real file.

## Which model each tier uses

There are three tiers, but **you only configure the two cheaper ones.** The **ceiling** (strongest) tier is **never configured — it is always the model you are running the session on** (decision 0015). So if you run the session on Fable, ceiling work runs on Fable; run it on Opus, ceiling is Opus. bee doesn't pick it; it inherits your session model.

You configure only `generation` and `extraction`, under **`models`**, keyed by runtime (Claude Code vs Codex name models differently):

```jsonc
{
  "models": {
    "claude": {
      "extraction": "haiku",    // cheapest — retrieval, mechanical edits
      "generation": "sonnet"    // the mid worker that runs the loops (most cells)
      // no "ceiling" — it's whatever model runs your session
    },
    "codex": {
      "extraction": null,       // Codex has no per-agent model switch today →
      "generation": null        //   null means "enforce the tier via read budget + output cap in the prompt"
    }
  }
}
```

- **To change the worker models**, edit `models.claude.generation` / `extraction` (e.g. `"opus"` for a stronger worker tier). To change the **ceiling**, just run the session on a different model — there is no config for it.
- **What the short names mean (important).** For Claude Code these are **family aliases**, not exact version strings. The value must be one of exactly `haiku` · `sonnet` · `opus` · `fable` — the Claude Code Agent tool accepts only these four. Each alias is resolved **by Claude Code (not by bee)** to the current model of that family on your account. So `"sonnet"` isn't "some random Sonnet" — it means "the Sonnet tier", and the harness uses the latest. Today they resolve to:

  | alias | resolves to (current) | model id |
  |---|---|---|
  | `haiku` | Haiku 4.5 | `claude-haiku-4-5` |
  | `sonnet` | Sonnet 5 | `claude-sonnet-5` |
  | `opus` | Opus 4.8 | `claude-opus-4-8` |
  | `fable` | Fable 5 | `claude-fable-5` |

  You **cannot pin an exact sub-version** for a Claude Code subagent — the model param is family-alias only, and it tracks the latest of each family as Anthropic ships new ones. (For **Codex**, the `codex` tiers take the runtime's real model ids, e.g. `"gpt-5"`, because that runtime addresses models by id.)
- `bee_status` prints the active map (`Models (claude): generation=… extraction=… · ceiling = the session model`), and warns if too many cells sit on the ceiling tier — the point is to keep the strong (session) model scarce.

## Removed keys

The `advisor` key was removed in v0.1.23 (decision fanout-delegation D1). If your `.bee/config.json` still has an `advisor` entry, onboarding will warn about the stale key but it will be ignored — no action needed.

## Other keys

| Key | What it does | Default |
|---|---|---|
| `commands` | the host project's `setup` / `start` / `test` / `verify` commands (power the baseline gate) | none — captured at onboarding |
| `gate_bypass` | opt-in autopilot: auto-approve Gates 1–3 for normal-lane work (safety floor stays) | `false` |
| `hooks` | per-hook kill switch (`session-init`, `prompt-context`, `write-guard`, `state-sync`, `chain-nudge`, `session-close`) | all `true` |
| `guards` | e.g. `{"idle_gate": false}` to disable the idle intake gate | idle gate on |
| `lanes`, `capabilities` | advanced per-repo overrides | `{}` |
| `dogfood_repos` | foreign repos whose feedback digest `bee_feedback.mjs collect`/`rank` (and `bee-evolving`) fold in — see below | `null` (local digest only) |

### `dogfood_repos` (P18, evolving loop)

Other repos running bee whose collected friction should feed into ranking here. Accepts a bare path
array or `{path,label}` objects (both normalize to objects); each entry is `realpath`-contained and
must have its own `.bee/feedback-digest.json` already written (`node .bee/bin/bee_feedback.mjs
digest` in that repo). A configured repo that is missing, unreadable, or dead is **skipped with a
warning**, never thrown:

```jsonc
{
  "dogfood_repos": [
    { "path": "../anphabe-gogl", "label": "anphabe-gogl" }
  ]
}
```

Every field pulled from a listed repo's digest is **revalidated and datamark-wrapped** by
`mergeDigests` before it is used (decision D2b) — this repo never trusts a foreign digest's bytes as
written. `null` (the default) means `collect`/`rank` return the local digest only, and
`corroboration` is 1 for every cluster (see `docs/07-contracts.md`'s `bee-evolving` contract).

## Full sample to copy

Clean JSON — paste into `.bee/config.json` and edit values (keep any existing `commands` you already have):

```json
{
  "commands": { "setup": "npm install", "start": "npm run dev", "test": "npm test", "verify": "npm run build" },
  "gate_bypass": false,
  "models": {
    "claude": { "extraction": "haiku", "generation": "sonnet" },
    "codex":  { "extraction": null, "generation": null }
  }
}
```

> **ceiling** has no entry — it is always whatever model you run the session on.
