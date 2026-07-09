# `.bee/config.json` — configuration reference

Every onboarded repo has a `.bee/config.json`. Any key you leave out uses a built-in default, so the file can be short — but the values below are the ones worth setting per repo. **`.bee/config.json` is strict JSON: no comments, no trailing commas.** The annotated block here is for reading; copy the clean block at the bottom into the real file.

## Where the ceiling / worker models are set

Model tiers live under **`models`**, keyed by runtime (Claude Code vs Codex name their models differently), then tier:

```jsonc
{
  "models": {
    "claude": {
      "extraction": "haiku",    // cheapest — retrieval, mechanical edits
      "generation": "sonnet",   // the mid worker that runs the loops (most cells)
      "ceiling":    "fable"     // the STRONGEST model — kept scarce (planning, integration, review, advisor)
    },
    "codex": {
      "extraction": null,       // Codex has no per-agent model switch today →
      "generation": null,       //   null means "enforce the tier via read budget + output cap in the prompt"
      "ceiling":    null        // set real ids (e.g. "gpt-5-pro") only if your Codex build supports switching
    }
  }
}
```

- **To change which model the ceiling uses**, edit `models.claude.ceiling` (e.g. `"opus"` instead of `"fable"`). Same for `generation` / `extraction`.
- **What the short names mean (important).** For Claude Code these are **family aliases**, not exact version strings. The value must be one of exactly `haiku` · `sonnet` · `opus` · `fable` — the Claude Code Agent tool accepts only these four. Each alias is resolved **by Claude Code (not by bee)** to the current model of that family on your account. So `"sonnet"` isn't "some random Sonnet" — it means "the Sonnet tier", and the harness uses the latest. Today they resolve to:

  | alias | resolves to (current) | model id |
  |---|---|---|
  | `haiku` | Haiku 4.5 | `claude-haiku-4-5` |
  | `sonnet` | Sonnet 5 | `claude-sonnet-5` |
  | `opus` | Opus 4.8 | `claude-opus-4-8` |
  | `fable` | Fable 5 | `claude-fable-5` |

  You **cannot pin an exact sub-version** for a Claude Code subagent — the model param is family-alias only, and it tracks the latest of each family as Anthropic ships new ones. bee just passes the alias through. (For **Codex**, the `codex` tiers take the runtime's real model ids, e.g. `"gpt-5-pro"`, because that runtime addresses models by id.)
- `bee_status` prints the active map (`Models (claude): ceiling=… generation=… extraction=…`), and warns if too many cells sit on the ceiling tier — the point is to keep the strong model scarce.

## Advisor mode (opt-in — cheap main loop, ceiling on demand)

Run the whole session on the cheaper `generation` model and consult the `ceiling` model only at the hard calls:

```jsonc
{
  "advisor": {
    "enabled": false,                             // set true to turn advisor mode on
    "at": ["shape", "execution", "blocked"]       // when to consult the ceiling: subset of
                                                  //   context · shape (Gate 2) · execution (Gate 3) · review · blocked
  }
}
```

When on, `bee_status` and the session preamble print a loud `ADVISOR MODE ON`. It never self-approves a human gate — it only informs the recommendation.

## Other keys

| Key | What it does | Default |
|---|---|---|
| `commands` | the host project's `setup` / `start` / `test` / `verify` commands (power the baseline gate) | none — captured at onboarding |
| `gate_bypass` | opt-in autopilot: auto-approve Gates 1–3 for normal-lane work (safety floor stays) | `false` |
| `hooks` | per-hook kill switch (`session-init`, `prompt-context`, `write-guard`, `state-sync`, `chain-nudge`, `session-close`) | all `true` |
| `guards` | e.g. `{"idle_gate": false}` to disable the idle intake gate | idle gate on |
| `lanes`, `capabilities` | advanced per-repo overrides | `{}` |

## Full sample to copy

Clean JSON — paste into `.bee/config.json` and edit values (keep any existing `commands` you already have):

```json
{
  "commands": { "setup": "npm install", "start": "npm run dev", "test": "npm test", "verify": "npm run build" },
  "gate_bypass": false,
  "models": {
    "claude": { "extraction": "haiku", "generation": "sonnet", "ceiling": "fable" },
    "codex":  { "extraction": null, "generation": null, "ceiling": null }
  },
  "advisor": { "enabled": false, "at": ["shape", "execution", "blocked"] }
}
```
