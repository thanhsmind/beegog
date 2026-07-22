# herdr-orchestrating — operator's guide

`SKILL.md` is written for the agent. This is written for you.

## What you get

One herdr workspace, two tabs:

```
cockpit ─┬─ chat      (yours)
         ├─ dispatch  (starts work)
         └─ merge     (retires work)

runtime ─── up to 4 working agents, one per backlog item, each in its own worktree
```

Every 60 seconds, dispatch looks for a free runtime slot and a ready backlog item, and starts an agent on it. Merge looks for a finished worktree, merges it, and closes its pane — which frees the slot dispatch watches next. That is the whole loop.

## Before you turn it on

**1. Main must be clean.** `bee worktree merge` refuses on a dirty main, and the merge role runs *in* main. Check:

```
git -C <main-root> status --porcelain
```

If bee's session logs show up there, untrack them once (they are meant to be ignored):

```
git -C <main-root> rm --cached .bee/logs/*.jsonl
git -C <main-root> commit -m "chore: untrack bee session logs"
```

**2. `gate_bypass` must be `full` or `total`.** Dispatch refuses to operate below that and will tell you so, every cycle. Check with `bee status --json`. This is deliberate: an agent working unattended must not inherit `normal`'s latitude for hard-gate work.

**3. There must be something ready.** This is the one people miss. The loop does not invent work — it picks up items *you* have already taken through exploring. An item is dispatchable only when **all four** hold:

- its backlog row is `in-flight` and carries a `` Feature `<slug>` `` annotation
- `docs/history/<slug>/CONTEXT.md` exists (i.e. it passed Gate 1)
- no worktree exists for it yet
- it has no cells yet

If nothing satisfies that, the loop runs correctly and does nothing. That is not a bug — it means the queue is empty, and filling it is your job.

## Turn it on

```
herdr workspace list                     # find your workspace id
bash .claude/skills/herdr-orchestrating/scripts/bootstrap-cockpit.sh \
    --workspace <id> --main-root <absolute path to the MAIN checkout>
```

`--main-root` is required and must be the main checkout, never a worktree — `bee worktree new` and `bee worktree merge` both refuse from inside a linked worktree, and a misrooted dispatcher would fail every cycle while dutifully continuing.

Useful first: `--dry-run` prints the herdr commands and executes nothing. `--no-start` builds the layout without launching the loops.

**Or invoke the skill directly.** Instead of running the script yourself, you can just invoke `herdr-orchestrating` with no `--role` given — the agent resolves `<main-root>` and the workspace id itself, runs the same two pre-flight checks above (main clean, `gate_bypass_level` full/total), checks for an already-running cockpit, and then runs `bootstrap-cockpit.sh` for you, passing through `--dry-run`/`--no-start` if you ask for either. The manual invocation above is still there and still useful for scripting or testing — this is just an alternative path for the common case.

## Is it working?

Watch your chat pane. Working looks like:

- `dispatch: picking <PBI-ID> — <reason>` before anything is created
- `dispatch: refusing <PBI-ID> — <what it saw>` when it declines something
- `merge: <slug> merged and cleaned up`

**Silence is ambiguous** and worth understanding: it means either nothing is ready, or all four slots are busy. Both are normal. `herdr pane list --workspace <id>` shows you which — a runtime pane per live item, labelled with its worktree.

## Stop and resume

```
touch <main-root>/.bee/tmp/herdr-orchestrating.stop     # both loops exit at the next cycle boundary
rm    <main-root>/.bee/tmp/herdr-orchestrating.stop     # they can start again
```

Nothing needs killing. The loops check that file before each cycle. Note the path is under the **main checkout** — that is the file both the loops and the bootstrap look at.

Removing the stop file does not restart them: it only lets them be started again. Re-run the bootstrap.

## When something happens

**`merge: <slug> came back MERGE_VERIFY_RED` — needs you.** The merge was abandoned before any commit existed; main is untouched. It is either a real semantic conflict or a flaky test. Investigate, then clear the marker so the loop will consider that worktree again:

```
rm <main-root>/.bee/tmp/herdr-orchestrating.red.<slug>
```

Until you remove it, that worktree is skipped. **This is on purpose.** The loop will not retry a red merge on its own — retrying once a minute is still retrying, and a genuine conflict that happened to pass on a second run would slip through the only gate the merge has.

**An anomaly is reported once, not once per cycle.** An unlabelled runtime pane, or one whose agent died mid-item, is reported and then left alone — never silently reclaimed. Its slot stays held until you deal with it. Four of those deadlock the runtime.

**Bootstrap refuses: "a pane labelled `dispatch` already exists".** Either a loop is running (stop it first), or the label is left over from a dead one — a label outlives the process that set it. Clear it:

```
herdr pane close <pane_id>          # or
herdr pane rename <pane_id> --clear
```

Stopping the loop alone does not clear the label.

**A dispatched agent is doing something you don't want.** It is a normal Claude session in its own worktree — open its pane and talk to it, or close the pane. Its worktree survives either way; `bee worktree list` shows it.

## What it will not do

- **It will not pick up hard-gate work.** Anything touching authentication, authorization, credentials, user data, deletion of tests or validation, external services or installers — refused and announced. When it is unsure, it refuses. Expect false refusals; they cost one cycle.
- **It will not merge past a red verify**, ever, on its own.
- **It will not exceed four concurrent working agents.**
- **It will not decide an item is finished because its agent went quiet.** Only bee's own record — cells capped with recorded evidence — counts as finished. An agent reports idle the moment it stops typing, whether it is thinking, waiting, or dead.

## Things worth knowing

- **The agents run with permission checks bypassed and no allowlist.** That, not the lane filter, is the real limit on what damage is possible: the filter decides *which item* is picked up, not *what commands* the agent may run. What contains it: the stop file, the four-slot cap, and each agent being confined to its own worktree.
- **Verify runs one at a time**, behind a lock shared by main and every worktree. Four concurrent verifies on a normal laptop produce red results caused by memory pressure, which look exactly like real failures. If you adopt this skill elsewhere, set your own lock path in `commands.verify`.
- **The impact ranking is judgement, not a stored field.** Two cycles over the same backlog can choose differently. The reason announced in chat is the only audit trail.
