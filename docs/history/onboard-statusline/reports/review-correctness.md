## Findings

### P2

1. Opt-in detection can misclassify a user-level statusline as project-level.

Summary → The presence of `CLAUDE_PROJECT_DIR` anywhere in the command causes an unconditional opt-in.

What happens today → After finding `.claude/statusline-command.sh`, `statuslineOptIn()` returns true whenever the command contains `CLAUDE_PROJECT_DIR`, without verifying that the variable anchors that statusline path.

Why it matters → Onboarding can create or overwrite project-local statusline files for a repository that did not opt in.

Concrete failure → `test -n "$CLAUDE_PROJECT_DIR" && bash ~/.claude/statusline-command.sh` is user-level but returns true and triggers `copy_statusline`.

Evidence → `skills/bee-hive/scripts/onboard_bee.mjs:875-877`:

```js
if (command.includes("CLAUDE_PROJECT_DIR")) {
  return true;
}
```

Smallest credible fix → Match the complete project-anchored path, such as `$CLAUDE_PROJECT_DIR/.claude/...` or `${CLAUDE_PROJECT_DIR:-.}/.claude/...`, rather than checking the variable independently. Add the mixed user-level command above as a negative test.

autofix_class → `gated_auto`

2. Removing the opt-in leaves a stale `managed.statusline` manifest entry.

Summary → The manifest does not transition back to a non-statusline-managed state after a repository opts out.

What happens today → When `statusline` is false, `subsetManaged()` omits that field from both sides of the comparison. An existing `onboarding.managed.statusline` therefore cannot make the manifest stale, so `write_onboarding` is not planned.

Why it matters → `.bee/onboarding.json` continues claiming the statusline pair is managed after onboarding has stopped managing it, contradicting the planned conditional-manifest contract.

Concrete failure → Onboard an opted-in repository, then change `statusLine.command` to `~/.claude/statusline-command.sh`. The next run reports `up_to_date`, while the old `managed.statusline` hashes remain.

Evidence → `skills/bee-hive/scripts/onboard_bee.mjs:1244-1260`, especially:

```js
if (statusline) {
  out.statusline = src.statusline || {};
}
```

Smallest credible fix → Include `statusline` in manifest comparison even when currently disabled, normalizing an absent entry to `{}` so an old nonempty entry triggers `write_onboarding`. Add an opt-in → opt-out transition test.

autofix_class → `gated_auto`

3. The required drift guard silently passes if both repository copies are deleted.

Summary → The byte-equality test does not catch deletion of the complete `.claude` pair.

What happens today → It checks whether any sibling exists and returns successfully when neither does, without checking the repository’s actual settings opt-in.

Why it matters → The plan explicitly requires a one-sided edit to make the guard fail. An accidental deletion of both vendored siblings would instead leave CI green.

Concrete failure → A change deletes both `.claude/statusline-command.sh` and `.claude/statusline-usage.mjs` while leaving the templates intact. `siblingExists` is false and the parity check is skipped.

Evidence → `skills/bee-hive/templates/tests/test_lib.mjs:3367-3370`:

```js
const siblingExists = names.some((name) => fs.existsSync(path.join(repoRoot, '.claude', name)));
if (!siblingExists) {
  return;
}
```

Smallest credible fix → Read `.claude/settings.json`; skip only when the repository is genuinely not opted in. When opted in, require every template sibling to exist and match byte-for-byte.

autofix_class → `gated_auto`

### P1

None.

### P3

None.

Verdict: PASS
