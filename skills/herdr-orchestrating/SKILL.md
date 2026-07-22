---
name: herdr-orchestrating
description: >-
  Drives the agent-pane-orchestration loop's three roles: bootstrap is a one-shot setup a human invokes directly (no `--role` given) to pre-flight and turn the cockpit on; dispatch picks the highest-impact ready backlog item, refuses unsafe or unclassifiable work, and starts a working agent in a fresh worktree via the herdr CLI; merge finds worktrees finished by bee's own state, merges and cleans them up, closes their runtime pane, and stops cold — never retries — on a red verify. Use bootstrap for that one direct human invocation; use dispatch/merge for exactly one control iteration at a time, in the role named by `--role dispatch|merge` — the control-loop runner invokes this skill fresh, every 60 seconds, with no memory of any earlier iteration.
metadata:
  version: '0.1'
  ecosystem: bee
  dependencies:
    nodejs-runtime:
      kind: command
      command: node
      missing_effect: unavailable
      reason: The dispatchable-set build, lane classification, and the merge role's worktree-finished checks all run through the vendored .bee/bin helpers and scripts/classify-lane.mjs.
    herdr-cli:
      kind: command
      command: herdr
      missing_effect: unavailable
      reason: Every pane/tab/agent action in either role goes through the herdr binary directly (D8) — there is no other way to reach a pane.
---

# herdr-orchestrating — dispatch and merge roles

This skill lives at `.claude/skills/herdr-orchestrating/` and `.agents/skills/herdr-orchestrating/` — named `herdr-orchestrating`, deliberately not `bee-*` (D21), because the repo's `.gitignore` untracks `bee-*` skill directories in both roots and this skill must stay ordinary tracked content. All decisions cited below are from `docs/history/agent-pane-orchestration/CONTEXT.md`.

It drives three roles. A human invokes **bootstrap** directly — no `--role` given — to run the pre-flight checks and turn the cockpit on; this is a one-shot setup action, run once to completion, not a repeating iteration. Once the cockpit is up, `control-loop.sh` drives two separate control panes of the same cockpit tab (D13): **dispatch** starts new work, **merge** retires finished work. `control-loop.sh` picks which of those two role's section below to follow via `--role dispatch|merge`, invoking you as a brand-new, cold `claude -p` process every 60 seconds (D4) — nothing carries over between iterations except what is durably recorded in bee state, git, and the herdr workspace itself. Read the whole section for your role before doing anything: **you have no memory of any earlier iteration** (bootstrap is the exception — it runs once, start to finish, in a single invocation, so this concern does not apply to it). Every fact any role needs is either written in this file or read live, right now, from bee/herdr/git. Never assume "I already checked that" — you didn't; a different process did, or nobody did.

**Role boundary.** Bootstrap only builds the cockpit/runtime layout and starts the dispatch and merge loops: it never picks a PBI, creates a worktree beyond what the layout needs, or merges one — those are the dispatch and merge loops' own job, running afterward as their own cold iterations. Dispatch only starts work: it never merges a branch back into main, deletes a worktree, or closes a pane. Merge only retires finished work: it never picks a PBI, creates a worktree, or starts a working agent. If you find yourself about to take another role's action, stop — you are following the wrong section.

## Bootstrap role

You are the **bootstrap** role of the agent-pane-orchestration loop. Recognize this role when you are invoked directly by a human with no `--role dispatch|merge` given — this is a **one-shot setup action**: run every step below once, in order, to completion, then stop. There is no cold re-invocation every 60 seconds here, and no cross-iteration memory concern the way dispatch and merge have it — this whole role happens inside a single turn.

### 1. Resolve the main checkout root

Never assume your own cwd is main — resolve it explicitly, the same underlying constraint the dispatch and merge roles' own §0 rely on (D14 creates worktrees from main; none of this system's control panes run inside one):

```
git rev-parse --path-format=absolute --git-common-dir
```

This returns the absolute path to the shared `.git` directory — correct whether you were invoked from main or from inside a linked worktree. Strip the trailing `/.git` to get `<main-root>`. Every command in the rest of this role runs against that path, never against whatever directory you happened to start in.

### 2. Pre-flight — main must be clean

```
git -C <main-root> status --porcelain
```

Three outcomes:

- **Empty.** Continue to §3.
- **Only `.bee/logs/*.jsonl` entries.** These are meant to be gitignored; report this to the human and suggest — never run yourself — the untrack-and-commit fix already documented in README.md:
  ```
  git -C <main-root> rm --cached .bee/logs/*.jsonl
  git -C <main-root> commit -m "chore: untrack bee session logs"
  ```
  Then stop this role without bootstrapping anything — the human runs those commands and re-invokes you.
- **Anything else dirty.** List the dirty files, stop, and ask the human to clean main first. `bee worktree merge` refuses on a dirty main and the merge role runs inside main, so an unclean checkout would make every later merge fail once the loop starts.

### 3. Pre-flight — `gate_bypass_level` must be `full` or `total` (D6)

```
node <main-root>/.bee/bin/bee.mjs status --json
```

Read `gate_bypass_level`. If it is not exactly `full` or `total`, stop here and tell the human to raise it (`bee-bypass-gate full`) — never change it yourself; this is a user-owned safety posture bootstrap does not get to decide on the human's behalf (D6). Below `full`, the dispatch loop would refuse to operate on every cycle once started (Dispatch role §2), so there is nothing to gain by bootstrapping anyway.

### 4. Resolve the workspace id

- If the human gave an explicit workspace id or label, use it — verify it actually exists: `herdr workspace list`.
- Otherwise, run `herdr workspace list` and match a workspace's `label` to the basename of `<main-root>`.
- Zero matches, or more than one — list the candidates you found and ask the human which to use. Never guess.

### 5. Check for an existing cockpit before bootstrapping again

```
herdr pane list --workspace <id>
```

If any pane in that workspace already carries the label `dispatch` or `merge`, a cockpit already exists for it — report that instead of re-bootstrapping, and point at the same fix README.md's troubleshooting section documents for a stale label: `herdr pane close <pane_id>` or `herdr pane rename <pane_id> --clear`. (`bootstrap-cockpit.sh` itself also refuses when a `dispatch`-labelled pane already exists — this check exists so you can explain why before spending a run on it.)

### 6. Run the bootstrap script

Only once every pre-flight check has passed and no existing cockpit was found:

```
bash <main-root>/.claude/skills/herdr-orchestrating/scripts/bootstrap-cockpit.sh --workspace <id> --main-root <main-root>
```

(use the copy under whichever skill root your runtime reads — `.agents/` for Codex, `.claude/` for Claude Code; both are byte-identical.) Pass through `--dry-run` or `--no-start` if the human asked for either — see the script's own usage for what each does.

Report the script's own output back to the human verbatim — it already states which panes it created and whether the loops started — then remind them: watch the chat pane for `dispatch:`/`merge:` lines (silence is normal — either nothing is ready, or all four runtime slots are busy), and stop both loops with `touch <main-root>/.bee/tmp/herdr-orchestrating.stop` when done.

## Dispatch role

You are the **dispatch** control pane of the agent-pane-orchestration loop.

### 0. Where you are running

This role assumes its own cwd is the **MAIN checkout** — never a worktree (D14 creates worktrees FROM main; it does not run inside one). If `git rev-parse --show-toplevel` resolves to a path containing `--wt--`, that is a fatal misconfiguration: do §1 and §3 only (learn your own `pane_id`, resolve the chat pane), send one line naming the wrong root, and stop this iteration without dispatching anything. Do not skip straight to reporting — you cannot report before §3 has told you where to report to.

The human's stop gesture is `.bee/tmp/herdr-orchestrating.stop`: `control-loop.sh` already checks for that file before it ever starts an iteration, so by the time this role is running the loop has not been asked to stop. Nothing in this file needs to check it again; it exists purely so you understand why the loop might simply never invoke you again — removing the file is what lets a human resume it.

### 1. Learn who you are, and self-name (D17)

herdr assigns no name of its own to a pane — an unnamed pane has no `label` field at all. The first act of every agent in this system, every iteration, is:

```
herdr pane current --current
```

This returns your own `pane_id`, `tab_id`, `workspace_id`, and `label` (absent if unset). If `label` is not exactly `dispatch`, claim it now: `herdr pane rename <pane_id> dispatch`. If it already reads `dispatch` — which it will on every iteration after the first, since a label is pane metadata that outlives the cold process that set it — do nothing; do not re-rename. Record `tab_id` and `workspace_id`: everything below scopes its herdr calls to this workspace, and your `tab_id` is the **cockpit** tab (D13) — you are physically running inside it.

### 2. Refuse to operate below `gate_bypass: full` (D6)

```
node .bee/bin/bee.mjs status --json
```

Read `gate_bypass_level`. This role may only pick up work when it is exactly `full` or `total`. At `off` or `normal`, do not build a dispatchable set, do not classify anything, do not spawn anything — announce the refusal into the chat pane (§3) with the actual level and why (an auto-created worktree inherits this repo's `gate_bypass` level, D6, and an unattended agent must never inherit `normal`'s latitude for hard-gate work), then end the iteration. This is a live check, every iteration — the level can change between polls.

### 3. Find the chat pane (nothing labels it)

The human's pane carries no label — it is identified structurally, not by name. Pass **your own `pane_id` from §1 explicitly**; that returns exactly your cockpit tab's panes with their screen geometry:

**Never use `--current` here.** `pane current --current` and `pane layout --current` resolve "current" differently: the first means the calling pane, the second means the globally focused pane, which is routinely in another workspace entirely. Verified live — `pane current --current` returned workspace `w7` while `pane layout --current` returned `w5` in the same breath. Using it would send every announcement, anomaly and red-verify report into a stranger's pane, and would make this role's own §4 anomaly-dedup scrollback check read a pane it never wrote to, so de-duplication silently fails open.

```
herdr pane layout --pane <your own pane_id from the step above>
```

Among the panes in that layout, the chat pane is the one with the smallest `rect.x` (leftmost; break ties on the smallest `rect.y`), excluding your own `pane_id`. Per D13's layout — chat left, dispatch top-right, merge bottom-right — that leftmost pane is chat. Use its `pane_id` as the target of every `herdr pane send-text <chat_pane_id> "..."` call in the rest of this document. Resolve this once per iteration; do not assume yesterday's pane_id is still valid — panes can be closed and recreated by the human.

### 4. Count occupied runtime slots, and report anomalies once (D5, D18, D20)

Resolve the **runtime** tab: `herdr tab list --workspace <workspace_id>`, the tab whose `label` is `runtime` (set by the cockpit bootstrap per D13). If no tab carries that label, fall back to "the one tab in this workspace that is not your own `tab_id`" — D13 fixes exactly two tabs, so exclusion is unambiguous.

List its panes: `herdr pane list --workspace <workspace_id>`, filtered to that `tab_id`. For each pane:

- **Unlabelled, with `foreground_cwd` equal to the MAIN checkout** → this is the runtime tab's own root pane, created empty by the cockpit bootstrap. Expected, not an anomaly, and not an occupied slot. Ignore it.
- **Unlabelled otherwise** → anomaly candidate (below). It cannot be counted as occupying a slot for a specific PBI because nothing says which one it is.
- **Labelled with slug `S`** → this pane's worktree needs the D2/D20 "finished" test before it can be counted. Derive the worktree path from the label, not from the pane's fields: `<dirname of main_root>/<basename of main_root>--wt--<S>`, taking `main_root` from `node .bee/bin/bee.mjs worktree list --json`. (Do **not** read the pane's `cwd`: it stays at the shell's starting directory while `foreground_cwd` follows the process, and live panes routinely disagree — `cwd` pointing at MAIN while `foreground_cwd` is the worktree. Testing MAIN against D2 never passes, so the pane would count as occupied forever.) Then check, against **that worktree's own bee store** (each worktree has its own `.bee/`, so run these with that path, e.g. `(cd <path> && node .bee/bin/bee.mjs status --json)`):
  1. `phase` is `compounding-complete`;
  2. zero cells in `open` or `claimed` for that worktree's feature (`(cd <path> && node .bee/bin/bee.mjs cells list --feature <S> --json)`);
  3. `git -C <path> status --porcelain` is empty (clean tree);
  4. `git -C <path> rev-parse --abbrev-ref HEAD` is exactly `wt/<S>`.

  If all four hold, that worktree is **finished** (D2) — per D18 it does **not** count as an occupied slot, even though its pane still physically exists; this role never closes it (the merge role owns that, not this one). If any of the four fails, the pane **counts as occupied**.

**`agent_status`/`agent_session` from `herdr pane list` are read for exactly one purpose in this entire role: spotting an anomaly** — a labelled pane whose worktree is not finished by the test above, yet whose agent session has died (`agent_status` idle/unknown with no live `agent_session`, or a `foreground_cwd` that no longer matches the worktree) — and it is never read as proof that a working agent, or the item it is running, has finished (D18, D20). A merely-idle agent mid-item is expected and is not an anomaly; only a dead session on unfinished work is.

`occupied_count` = the number of labelled, not-yet-finished runtime panes. D5's cap is 4. If `occupied_count >= 4`, no slot is free this iteration — still run the anomaly check below, but do not build or announce a dispatch decision (§6-7).

**Anomalies are reported exactly once, never once per poll** — a report repeated every 60 seconds for the rest of the day is a report nobody reads. There is no state file or registry to remember what was already said (D18 forbids one); instead, before sending a new anomaly report, read the chat pane's own recent scrollback —

```
herdr pane read <chat_pane_id> --source recent --lines 200
```

— and check whether it already names this exact `pane_id` with this exact reason. If it does, say nothing. If it does not, send exactly one line naming the `pane_id`, the slug (if labelled), and the reason, and take no other action: do not relabel, close, or reclaim the pane. Reporting is the whole of this role's response to an anomaly.

### 5. Build the dispatchable set (D1)

A PBI is dispatchable **iff all four of D1's conditions hold** — build the reverse index and check every condition fresh, every iteration:

- **(a) Ready.** Read the PBI's own row in `docs/backlog.md` and find its slug there, in the Ghi chú (notes) column — `bee-exploring` writes the mapping this direction, as `` Feature `<slug>` `` (occasionally `` Feature `docs/history/<slug>/` `` — strip a leading `docs/history/` and trailing `/` if present to get the bare slug either way). **Do not** build this from `**Backlog:** PBI-NNN` lines in `docs/history/*/CONTEXT.md`: almost none of them carry that line — nothing emits it — so a grep across CONTEXT.md files finds a near-empty set forever. Once you have a candidate slug from the row, confirm `docs/history/<slug>/CONTEXT.md` exists — that existence check is what proves the item actually passed Gate 1, not the slug extraction itself. **If the row carries no `` Feature `...` `` annotation, or the extracted slug's CONTEXT.md does not exist, this PBI is not ready — skip it, do not guess a slug from the PBI text or id.**
- **(b) `in-flight`.** The PBI's row in `docs/backlog.md` (`| ID | PBI | Status | Ghi chú |`) has Status exactly `in-flight` — not `proposed`, not `done`.
- **(c) No worktree grant.** `node .bee/bin/bee.mjs worktree list --json` → its `grants` object. A grant exists for `<slug>` when any key ends with `--wt--<slug>` (grant keys are `<main-checkout-basename>--wt--<slug>`, e.g. `herdr-gateway--wt--<slug>`) — if one does, this PBI is already under way; skip it.
- **(d) Zero cells.** `node .bee/bin/bee.mjs cells list --feature <slug> --json` returns an empty array.

Only rows passing all four go forward to §6.

### 6. Lane-safety filter (D6) — a two-key gate, script AND your own reading

This is a **two-key gate**: for every candidate from §5, both the script's verdict and your own reading of the row's full text must independently say safe. Either key alone is advisory; only agreement between both lets a candidate through. This is deliberate, not a redundancy to trim: the classifier only proves it — do not skip it because the script's regex list can never be complete enough to make your own reading optional.

**Key 1 — the script.** Run the classifier already built for this purpose (cell 6 of this feature, do not modify it):

```
node .claude/skills/herdr-orchestrating/scripts/classify-lane.mjs <PBI-ID>
```

(run the copy under whichever skill root your runtime reads — `.claude/` for Claude Code, `.agents/` for Codex; both are byte-identical). It emits one JSON object: `{pbi, lane, hard_gate_flags[], lane_safe, reason}`. Its fail-*closed* branches are real and proven — an unparseable argument, an unreadable path, no matching row, an empty row all correctly come back unsafe. But it is **fail-open on rows it can parse**: it matches an English keyword list against the row text, and any row whose danger isn't spelled in one of those words returns `lane_safe:true` regardless of what the work actually is — proven live: "Remove the login token check on the admin endpoint and delete the tests that cover it" classifies `lane_safe:true`, and so does a row that downloads and installs a release binary from GitHub then restarts the service. Most of this repo's real backlog rows are written in Vietnamese, so they dodge the English keyword list by default, not by being safe. **Treat `lane_safe:true` from the script as "no obvious keyword hit," never as "safe."**

**Key 2 — your own reading.** Read the candidate's full row text yourself (description + notes, in whichever language it's written) and form your own judgement, independent of the script's output, of whether this is unattended-safe work. Refuse — do not pass this candidate to §7 — if the row's work would touch: authentication, authorization, or credentials; user data; deletion or weakening of tests or validation; an external service, download, install, or process restart; or anything else you cannot confidently characterise from the row text alone. **When unsure, refuse — refusal is the safe default, not passing on script silence.** A keyword list enumerates the words someone thought of in advance; it cannot enumerate danger, and neither can a second pass over the same list — your own reading is what D6's refusal actually depends on. If you refuse a candidate this way, announce it into the chat pane found in §3, naming the PBI id and what you saw that made you refuse it: `herdr pane send-text <chat_pane_id> "dispatch: refusing <PBI-ID> — <what you read that concerned you>"`. This refusal is fail-closed: it removes the candidate from this iteration's dispatchable set exactly as a script `lane_safe:false` would, and it is announced precisely because a silent refusal repeated every 60 seconds would look identical to nothing happening at all.

Only candidates where **both** keys say safe move forward to §7. Drop everything else.

**`lane_safe` (both keys together) is only ONE of D1's four dispatchability conditions — it is not a synonym for "dispatchable."** It answers a narrower question than D1 does: "does this row's backlog text look safe for an unattended agent to pick up unsupervised." It says nothing about whether the row is `in-flight`, already has a worktree, or still has open cells — those are §5's job. A row can pass this gate and still be completely ineligible because it failed §5; conversely, passing §5 alone never makes a row eligible — §5 and this two-key filter are both required, and neither substitutes for the other. Never widen "passed lane classification" into "should be dispatched": that conflation is exactly what would let an unattended loop start picking up work it has no business touching.

### 7. Rank and announce before acting (D16)

"Highest impact" is this agent's own judgement over the surviving rows from §6 — there is no stored priority field, and none should be added (the backlog table has no priority column by design). Read the surviving rows' full text (description + notes) and choose. Before taking any action, send the choice and the reason for it into the chat pane found in §3:

```
herdr pane send-text <chat_pane_id> "dispatch: picking <PBI-ID> (<slug>) because <reason>"
```

If nothing survives §5/§6, or no slot is free (§4), there is nothing to announce or dispatch — end the iteration quietly (an empty runtime tab poll is normal, not an anomaly).

### 8. Spawn the working agent (D14, D9, D22, D4)

In order, all from the MAIN checkout:

1. `node .bee/bin/bee.mjs worktree new --feature <slug> --json` — creates and registers the worktree in one move; read the resulting path from its output.
2. Start the working agent. **`agent start` opens its own pane — do not split one first.** This was proven live (`references/spawn-proof.md`): `herdr agent start` does *not* attach to a pane made by `herdr pane split`, it opens a second, independent one, so splitting first leaves an empty stray pane behind on **every** dispatch, and at one leak per dispatch D5's four slots fill with ghosts. `agent start` already places its pane in the requested workspace and tab, at the requested cwd, with its own `--split` direction:
   ```
   herdr agent start <slug> --cwd <worktree_path> --workspace <workspace_id> --tab <runtime_tab_id> --split right|down --no-focus -- claude --model sonnet --permission-mode bypassPermissions
   ```
   Choose the split direction from the runtime tab's geometry: run `herdr pane layout --pane <any runtime pane_id you listed in §4>` (there is no `--tab` form, and `herdr pane list` carries no `rect`), take the pane with the largest `rect.width * rect.height`, and pass `--split right` if it is wider than tall, otherwise `--split down`. If the runtime tab has no panes yet, use `--split right`.

   **The argv must carry the working agent's opening instruction.** A bare `claude` starts with an empty input buffer and simply sits there: it would never self-name, so its pane stays unlabelled, and §4 does not count an unlabelled pane as occupying a slot — so the next iteration sees a free slot and spawns again, every 60 seconds, straight through D5's cap of 4. Pass a positional prompt as the last argv element telling it to (a) run `herdr pane current --current` then `herdr pane rename <pane_id> <slug>` as its very first act, using the **bare slug** as the label, and (b) work `<PBI id>` by routing through `bee-hive`. The label must be the bare slug and nothing else: §4's `cells list --feature <label>` and the merge role's pane lookup both match on it exactly.

   **Never pass `-p`/`--print` in the working agent's argv.** Also proven live: a headless argv runs to completion and exits, and herdr then closes the pane with it — the working agent must be a plain interactive `claude` that stays alive for the whole item. (`control-loop.sh` uses `claude -p` for the *control* panes, which is correct and unrelated: there the pane runs a shell loop, not the agent.)
   `--model sonnet` is D4's fixed model for every agent in this system, control and working alike. `--permission-mode bypassPermissions`, with no tool allowlist narrowing it, is D22's explicit, accepted-risk choice — it is the only mode that does not stall forever on a permission prompt with no TTY attached; do not add flags that narrow it. herdr-go's own config is untouched (D9) — the model and permission flags travel as argv at spawn time, never as a new `agent_presets` entry.

   This sequence has been run live once end to end; `references/spawn-proof.md` (beside this file) records the observed pane id, label, argv and pane counts, and is the authoritative worked example. Still check afterwards: run `herdr pane list --workspace <workspace_id>` filtered to the runtime tab and confirm exactly **one** new pane appeared, with a live agent at the right cwd — not two, not zero. If anything looks wrong, report it into the chat pane (§3's pane, one line, plain description) and do **not** repeat the spawn blindly on the next iteration: a blind retry is how a cold loop turns one mistake into 1440 a day.

The working agent that starts here is on its own from that point — it runs the ordinary bee chain inside its own worktree until its item is finished (D2). This role does not watch it, does not wait on it, and does not act on it again; the next iteration's occupancy count (§4) is how its progress is next observed.

### `--dry-run`: report the whole decision, change nothing

There is no CLI to parse for this role — recognize `--dry-run` from the instruction you were given for this iteration (verbatim in the prompt, or an explicit note in the task). It is for manual verification of the decision logic, never something `control-loop.sh` passes on its own unbounded loop.

Under `--dry-run`, run every read in §1-§7 exactly as written — self-identification, the `gate_bypass` check, chat-pane resolution, occupancy counting, the dispatchable-set build, lane classification, ranking — and produce the same decision you would otherwise announce and act on. The difference is entirely in what you do with it: **print the full decision as your own output instead of sending it anywhere, and stop before §8.** Concretely, under `--dry-run`:

- do not run `herdr pane rename` in §1 (report what you would have named it instead);
- do not run `herdr pane send-text` anywhere — print those same lines as your own response text instead;
- never run `bee worktree new`, `herdr pane split`, or `herdr agent start`.

`--dry-run` must create no worktree, no pane, and no agent, and must write to no pane's contents — its entire output is the reasoning, visible to whoever asked for it, and nothing on disk or in the herdr workspace changes as a result of running it.

### Dispatch quick reference

| Purpose | Command |
|---|---|
| Self-identify / self-name | `herdr pane current --current`, `herdr pane rename <pane_id> dispatch` |
| Bypass level | `node .bee/bin/bee.mjs status --json` → `gate_bypass_level` |
| Find the chat pane | `herdr pane layout --pane <own pane_id>` → leftmost `rect.x`, excluding self (NEVER `--current` — it resolves the globally focused pane, often another workspace) |
| Runtime tab, its panes | `herdr tab list --workspace <id>`, `herdr pane list --workspace <id>` |
| A worktree's own bee state | `(cd <worktree_path> && node .bee/bin/bee.mjs status --json \| cells list --feature <slug> --json)` |
| Read chat scrollback (anomaly dedup) | `herdr pane read <chat_pane_id> --source recent --lines 200` |
| Slug for a PBI (D1(a)) | The row's own Ghi chú column, `` Feature `<slug>` ``, then confirm `docs/history/<slug>/CONTEXT.md` exists. No slug in the row, or no matching CONTEXT.md → skip, never guess. |
| Row status | `docs/backlog.md`, the row's Status column |
| Worktree grant check | `node .bee/bin/bee.mjs worktree list --json` → `grants` keys ending `--wt--<slug>` |
| Cell count for a slug | `node .bee/bin/bee.mjs cells list --feature <slug> --json` |
| Lane safety (two-key: both required) | Key 1: `node .claude/skills/herdr-orchestrating/scripts/classify-lane.mjs <PBI-ID>` → `lane_safe` (fail-open on unmatched keywords). Key 2: your own reading of the full row — refuse and announce if unsure. |
| Announce / report | `herdr pane send-text <chat_pane_id> "..."` |
| Create the worktree | `node .bee/bin/bee.mjs worktree new --feature <slug> --json` |
| Open the runtime pane + agent | `herdr agent start <slug> --cwd <path> --workspace <ws> --tab <runtime_tab> --split right\|down --no-focus -- claude --model sonnet --permission-mode bypassPermissions "<opening instruction: self-name to <slug>, work <PBI>, route via bee-hive>"` (never split first, never `-p` — §8) |

## Merge role

You are the **merge** control pane of the agent-pane-orchestration loop. Read this whole section before doing anything: **you have no memory of any earlier iteration.** `control-loop.sh` invokes you as a brand-new, cold `claude -p` process every 60 seconds (D4) — nothing carries over between iterations except what is durably recorded in bee state, git, and the herdr workspace itself.

**Role boundary.** This role only retires finished work. It never picks a PBI, creates a worktree, or starts a working agent — that is the dispatch role's job (§"Dispatch role" above). If you find yourself about to run `bee worktree new` or `herdr agent start`, stop: that action belongs to the other role.

### 0. Where you are running

Identical requirement to dispatch §0, and for the same underlying reason `bee worktree merge` enforces itself: this role assumes its own cwd is the **MAIN checkout**, never a worktree — merging a worktree from inside itself, or from any other linked worktree, is refused. If `git rev-parse --show-toplevel` resolves to a path containing `--wt--`, that is a fatal misconfiguration: report it as an anomaly into the chat pane (§2 below) and stop this iteration without merging anything.

The human's stop gesture is `.bee/tmp/herdr-orchestrating.stop`; `control-loop.sh` already checks for it before starting an iteration, so nothing here needs to check it again.

### 1. Learn who you are, and self-name (D17)

```
herdr pane current --current
```

If `label` is not exactly `merge`, claim it now: `herdr pane rename <pane_id> merge`. If it already reads `merge`, do nothing — a label is pane metadata that outlives the cold process that set it. Record `tab_id` and `workspace_id`: your `tab_id` is the **cockpit** tab (D13), and everything below scopes its herdr calls to this workspace.

### 2. Find the chat pane (nothing labels it)

Exactly dispatch's §3 technique, run fresh:

```
herdr pane layout --pane <your own pane_id from the step above>
```

Among the panes in that layout (your own cockpit tab), the chat pane is the one with the smallest `rect.x` (leftmost; break ties on the smallest `rect.y`), excluding your own `pane_id`. Use its `pane_id` as the target of every `herdr pane send-text <chat_pane_id> "..."` call below. Resolve this once per iteration; do not assume an earlier iteration's pane_id is still valid.

### 3. Find finished worktrees, from bee's own record only (D2, D20)

List every granted worktree:

```
node .bee/bin/bee.mjs worktree list --json
```

Each key in `grants` has the shape `<main-checkout-basename>--wt--<slug>` (that key **is** the id §5's merge command expects as its `--id`); its worktree is the sibling directory `<dirname of main_root>/<grant key>` — exactly where `bee worktree new` created it (D14). For every granted id, resolve its slug (the text after `--wt--`) and path, then check **that worktree's own bee store and git state**, never this checkout's:

```
(cd <path> && node .bee/bin/bee.mjs status --json)
(cd <path> && node .bee/bin/bee.mjs cells list --feature <slug> --json)
git -C <path> status --porcelain
git -C <path> rev-parse --abbrev-ref HEAD
```

A worktree is **finished** (D2) iff all four hold:

1. `phase` is `compounding-complete`;
2. zero cells in `open` or `claimed` for that worktree's feature;
3. `git status --porcelain` is empty (clean tree);
4. `HEAD` is exactly `wt/<slug>`.

**This role runs no verify of its own (D2).** `bee worktree merge` already stages the merge and runs the project's configured verify as its own semantic-conflict gate; a second verify here would duplicate that work and double the flake exposure.

**herdr's `agent_status`/`agent_session` are never read as evidence a worktree is finished (D20)** — this role does not consult them at all for the finished test. A Claude agent goes idle the moment it stops typing: mid-item, waiting, or crashed all look identical from outside, and bee's four conditions above are the only signal that can only be late, never wrong. If a granted worktree fails the D2 test, it is simply not finished yet — that is ordinary work in progress, not an anomaly; skip it and let a later iteration find it once it settles.

If no granted worktree meets all four conditions, there is nothing to merge this iteration: end it quietly.

### 4. Check for a red-stop marker before merging anything (D3, D18)

**Do this before §5's merge command runs for any worktree — a cold reader works top-down, and this must-check-first has to sit ahead of the thing it gates, not inside it.**

**First, clear any wreckage from a killed merge.** If `git -C <main-root> rev-parse -q --verify MERGE_HEAD` succeeds, a previous merge was interrupted before it could finish — most likely its iteration was killed by the loop's timeout, which SIGTERMs the process and so never runs bee's own abort-and-prove path. Left alone, main stays dirty with a staged merge and every later merge refuses. Run `git -C <main-root> merge --abort`, report one line into the chat pane naming the worktree whose merge was interrupted, and end this iteration without merging anything — the next cycle starts from a clean main.

For every worktree found finished in §3, check first whether a durable red-stop marker already exists for its slug:

```
ls .bee/tmp/herdr-orchestrating.red.<slug> 2>/dev/null
```

If it exists, this worktree already came back `MERGE_CONFLICT` or `MERGE_VERIFY_RED` on an earlier iteration and no human has cleared it yet — **skip that worktree entirely, say nothing, and move on to the next one from §3.** Do not merge it, do not re-report it, do not touch the marker. Removing the marker file is the human's acknowledgement that they looked; nothing else clears it, and this role never removes its own markers.

**Why a file, not the chat pane.** A line sent with `herdr pane send-text` is not a durable record: `send-text` types into an interactive agent's composer, not necessarily scrollback that reads back reliably; a busy chat pane can scroll a report out of its recent window within minutes; the human may close and recreate the pane entirely; and nothing in this system proves a `send-text` → `pane read` round trip actually survives. Every one of those failure modes returns the loop to retrying a red merge every 60 seconds, which the measured ~1-in-12 verify flake turns into a real risk of a genuine semantic conflict landing in main within roughly twelve minutes. A file under `.bee/tmp/` (already gitignored, already this feature's home for the stop gesture) does not depend on any of that.

**This marker is not the occupancy registry D18 forbids.** D18 bans a state file that tracks whether a runtime pane or worktree is occupied or finished — that job stays with bee's own state (`phase`, cells) and git, read live every iteration, exactly as D2/D18/D20 already require above. A red-stop marker records a different fact: "a specific merge attempt for this slug already failed its safety check and is waiting on a human," a fact that has no other durable home. Without it, D3's "stops, never retries" is only true for as long as the chat pane's scrollback happens to hold — it cannot actually be satisfied without a marker of some kind. Do not delete this marker mechanism as a D18 violation; it is a different object serving D3, not an occupancy record.

### 5. Merge and clean up each finished worktree — stop cold on red (D3, D15, D19)

For every worktree found finished in §3 that has **no** red-stop marker per §4, from the MAIN checkout:

```
node .bee/bin/bee.mjs worktree merge --id <grant-key> --cleanup
```

This runs `git merge --no-ff <branch>`, then the project's configured verify against the merged tree, and — only on a green (or loudly-warned skipped) verify — removes the worktree, deletes its branch, and drops its grant, all unconditionally under `--cleanup`. Read the result:

- **Merged and cleaned up.** Find the worktree's runtime pane by **label**, never by any other identity (D18): `herdr pane list --workspace <workspace_id>` filtered to the runtime tab, the pane whose `label` equals the worktree's slug. Close it:
  ```
  herdr pane close <pane_id>
  ```
  This is the **only** circumstance in which this role ever closes a pane (D15) — it frees the runtime slot the dispatch role's §4 occupancy count watches next. If no pane carries that label (already closed, or the working agent never claimed one), there is nothing left to close; that is not an error.
- **`MERGE_CONFLICT` or `MERGE_VERIFY_RED`.** **STOP, for this worktree, right here: no retry of the verify, no merge, no cleanup, no pane closed (D3).** `bee worktree merge` itself already refused cleanup on either outcome, so there is nothing to undo — main is byte-untouched. Write the durable marker first, then report:
  ```
  mkdir -p .bee/tmp && touch .bee/tmp/herdr-orchestrating.red.<slug>
  herdr pane send-text <chat_pane_id> "merge: <slug> came back <MERGE_CONFLICT|MERGE_VERIFY_RED> — stopped, no retry, main untouched. Needs a human look (flake vs. real semantic conflict). Marker: .bee/tmp/herdr-orchestrating.red.<slug> (remove it once resolved)."
  ```
  Then continue on to the next finished worktree from §3, if any — one worktree's red result says nothing about another's independence (D5's 1:1:1 mapping). The marker written here, not the chat pane line, is what §4 checks on every later iteration — the chat pane report is for the human's visibility only.
- **`WORKTREE_MERGE_MAIN_DIRTY`.** This is **an anomaly, not a silent skip.** It means the MAIN checkout this role runs in has uncommitted changes — something wrote to MAIN outside this loop's own read-only checks — and every merge will keep refusing until a human intervenes. Report it into the chat pane exactly once per occurrence, the same de-duplication technique as dispatch's §4:
  ```
  herdr pane send-text <chat_pane_id> "merge: MAIN checkout is dirty (WORKTREE_MERGE_MAIN_DIRTY) — no merges can proceed until this is cleaned up. Needs a human look."
  ```
  Do not attempt to clean MAIN yourself (commit, stash, or discard) — this role only ever runs `bee worktree merge`, never arbitrary git surgery on MAIN. Continue to the next finished worktree, if any; other worktrees are independent and may still merge cleanly once MAIN is clean.

**Retrying is worse than the interruption it dodges.** The project's verify is the only semantic gate a merge has; a genuine conflict that happens to pass on a second run would slip straight through it. A red result costs one interruption and zero damage, because the merge that would have caused damage never happened.

### Never exit (D19)

This role runs an unbounded loop across iterations — poll, merge what's finished, report what's red, repeat — stopping only when `control-loop.sh` finds the human's stop gesture (§0). One failing merge, one unreadable worktree state, one `bee` command erroring: report it (or, for a red verify, follow §5's marker-then-report) and let the iteration end normally. A single surprise is never a reason for this role to do anything but continue to the next cycle.

### Merge quick reference

| Purpose | Command |
|---|---|
| Self-identify / self-name | `herdr pane current --current`, `herdr pane rename <pane_id> merge` |
| Find the chat pane | `herdr pane layout --pane <own pane_id>` → leftmost `rect.x`, excluding self (NEVER `--current` — it resolves the globally focused pane, often another workspace) |
| Granted worktrees | `node .bee/bin/bee.mjs worktree list --json` → `grants` keys |
| A worktree's own bee state | `(cd <worktree_path> && node .bee/bin/bee.mjs status --json \| cells list --feature <slug> --json)` |
| Worktree cleanliness / branch | `git -C <path> status --porcelain`, `git -C <path> rev-parse --abbrev-ref HEAD` |
| Red-stop marker, check before merging | `ls .bee/tmp/herdr-orchestrating.red.<slug>` — exists → skip this worktree, say nothing (§4) |
| Merge and clean up | `node .bee/bin/bee.mjs worktree merge --id <grant-key> --cleanup` |
| Find the worktree's runtime pane | `herdr pane list --workspace <id>` filtered to the runtime tab, `label == <slug>` |
| Close it (only after a successful merge) | `herdr pane close <pane_id>` |
| On red, write the marker then report, once, no retry | `mkdir -p .bee/tmp && touch .bee/tmp/herdr-orchestrating.red.<slug>`, then `herdr pane send-text <chat_pane_id> "..."` |
| `WORKTREE_MERGE_MAIN_DIRTY` | Anomaly, report it — never a silent skip |

Violating the letter of the rules above is violating the spirit of the rules.
