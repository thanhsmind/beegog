# Installing bee

Source: **https://github.com/thanhsmind/beegog**

## Quick install (recommended): the install script

One command does everything below — fetches bee, installs the skills for the chosen runtimes, and onboards the target repo (greenfield or brownfield). **The current directory is the target by default** — `cd` into your project first. It always shows the exact plan and asks before writing (skip prompts with `-y`/`-Yes`).

macOS / Linux / Git Bash:

```bash
curl -fsSL https://raw.githubusercontent.com/thanhsmind/beegog/main/scripts/install.sh | bash -s -- -y
```

Windows PowerShell:

```powershell
iwr -useb https://raw.githubusercontent.com/thanhsmind/beegog/main/scripts/install.ps1 -OutFile install-bee.ps1
.\install-bee.ps1 -Yes
```

To target another directory instead, add `-d /path/to/project` (bash) / `-Directory C:\path\to\project` (PowerShell).

From a local clone: `scripts/install.sh [-d <target>]` / `.\scripts\install.ps1 [-Directory <target>]`.

Useful flags (same semantics in both scripts):

| bash | PowerShell | Effect |
|---|---|---|
| `--dry-run` | `-DryRun` | Show the exact plan for YOUR repo; write nothing |
| `--runtime claude\|codex\|both` | `-Runtime …` | Which runtime skills to install (default both) |
| `--claude-md` | `-ClaudeMd` | Also write/extend CLAUDE.md with the `@AGENTS.md` import |
| `--no-hooks` | `-NoHooks` | Skip repo-local hook wiring for Claude Code |
| `--no-git-init` | `-NoGitInit` | Greenfield: don't offer `git init` |
| `--source <path>` | `-Source …` | Use a local bee checkout instead of cloning |
| `-y` | `-Yes` | Non-interactive |

**Greenfield** (new/empty directory): the script creates the directory, offers `git init`, and installs everything fresh. **Brownfield** (existing repo): existing `AGENTS.md`/`CLAUDE.md` content is preserved byte-for-byte outside the managed BEE markers; `.bee/` state, decisions, and cells are never overwritten; `.claude/settings.json` merges get a `.bak` backup; re-running is idempotent (`up_to_date`). Run `--dry-run` first if you want to see the plan before anything is written.

The script uses the manual-copy route for skills. If you prefer the Claude Code **plugin route** (hooks ship automatically, centrally updatable), use Option A below instead and then run only step 3.

---

## Manual installation

bee installs in two layers, on both runtimes:

1. **Runtime layer** (once per machine): make the `bee-*` skills — and on Claude Code, the hook skeleton — available to the agent.
2. **Repo layer** (once per project): onboard the repository — installs the `AGENTS.md` BEE block, the `.bee/` runtime directory, and the vendored helpers that mechanically enforce the workflow for *any* agent.

Requirement for both: **Node.js 18+** on PATH (`node --version`).

> Path used in the examples: `D:\projects\tools\AI\bee`. Replace with wherever this plugin lives (a local clone of `thanhsmind/beegog` or the git URL).

---

## 1. Claude Code

### Option A — plugin install (recommended)

The plugin ships skills **and** the 6-hook automation skeleton (`hooks/hooks.json`); both load automatically once installed.

Inside a Claude Code session:

```text
/plugin marketplace add D:\projects\tools\AI\bee
/plugin install bee@bee
```

(For a git-hosted copy: `/plugin marketplace add <owner>/<repo>` or the full URL, then the same install command.)

Restart the session, then verify:

- `/plugin` → bee shows as installed and enabled.
- Ask: "What bee skills do you have?" → the ten `bee-*` skills should be listed.
- Hooks self-arm only in onboarded repos (they exit silently when `.bee/onboarding.json` is absent), so no hook activity is expected yet — that changes after step 3.

### Option B — no plugin system (fallback)

If you can't (or don't want to) use the plugin manager:

1. Copy the skills to a skills directory Claude Code reads:
   - per user: `%USERPROFILE%\.claude\skills\` (macOS/Linux: `~/.claude/skills/`)
   - or per repo: `<repo>\.claude\skills\`

   ```powershell
   Copy-Item -Recurse D:\projects\tools\AI\bee\skills\* $env:USERPROFILE\.claude\skills\
   ```

2. Wire the hooks per repo during onboarding with `--repo-hooks` (step 3 below) — this copies the hook scripts into `<repo>\.bee\bin\hooks\` and merges the 6 entries into `<repo>\.claude\settings.json` (a `.bak` backup is created; re-running never duplicates entries).

3. Optional third belt: `--claude-md` writes a minimal `CLAUDE.md` whose `@AGENTS.md` import auto-loads the BEE block even if hooks are disabled.

---

## 2. Codex

### Option A — plugin manifest

For Codex builds with plugin support, install from the plugin directory/repo; the manifest at `.codex-plugin/plugin.json` exposes `skills: ./skills/`, and the skills are self-prefixed (`bee-*`), so they stay namespaced even as a plain copy.

### Option B — manual skills copy (always works)

Copy each skill folder into your Codex skills directory (`$CODEX_HOME/skills/`, default `~/.codex/skills/`):

```bash
cp -r /d/projects/tools/AI/bee/skills/* ~/.codex/skills/
```

```powershell
Copy-Item -Recurse D:\projects\tools\AI\bee\skills\* $env:USERPROFILE\.codex\skills\
```

Codex has no lifecycle hooks — that's by design in bee: bootstrap comes from the `AGENTS.md` BEE block (installed in step 3), and every gate- and integrity-critical rule is enforced by the vendored helpers, identically to Claude Code. See [docs/06-runtime-integration.md](docs/06-runtime-integration.md) for the parity matrix.

---

## 3. Onboard each repository (both runtimes)

From any terminal, plan first (dry-run, changes nothing):

```bash
node D:\projects\tools\AI\bee\skills\bee-hive\scripts\onboard_bee.mjs --repo-root <your-repo> --json
```

Review the reported plan, then apply:

```bash
node D:\projects\tools\AI\bee\skills\bee-hive\scripts\onboard_bee.mjs --repo-root <your-repo> --apply
```

Flags:

| Flag | Effect |
|---|---|
| `--apply` | Actually install (without it: report-only) |
| `--repo-hooks` | Additionally copy hooks into `.bee/bin/hooks/` and merge them into `<repo>/.claude/settings.json` (Claude Code fallback when not using the plugin manager) |
| `--json` | Machine-readable output |

What onboarding installs:

```
<repo>/AGENTS.md          ← BEE block between <!-- BEE:START --> / <!-- BEE:END --> (content outside markers untouched)
<repo>/.bee/              ← onboarding.json, state.json, config.json (+ empty cells/, logs/)
<repo>/.bee/bin/          ← bee_status / bee_cells / bee_reservations / bee_decisions + lib/
<repo>/docs/history/learnings/critical-patterns.md   ← stub if missing
```

Existing `state.json`, `decisions.jsonl`, and `cells/` are **never** overwritten; re-running is idempotent and reports `up_to_date`.

Alternatively, do it conversationally: open a session in the repo and say **"Onboard this repository for bee"** — `bee-hive` runs the same script and asks before `--apply`.

---

## 4. Verify the install

In the onboarded repo:

```bash
node .bee/bin/bee_status.mjs --json
```

Expect `onboarding.installed: true`, `phase: "idle"`, all gates `false`.

Claude Code (plugin route) — start a new session in the repo: the session should begin with the bee preamble (phase, gates, critical-patterns digest) injected by `bee-session-init`. Quick hook check by hand:

```bash
echo '{"tool_name":"Write","tool_input":{"file_path":"src/x.ts"}}' | node .bee/bin/hooks/bee-write-guard.mjs
```

(with `--repo-hooks` install; for the plugin route the hooks run from the plugin directory — just watch the session preamble instead).

Codex — start a session in the repo: the agent should follow the AGENTS.md BEE block and run `bee_status` as its first scout step. Then try: "Route this through bee: fix the typo in README" → expect tiny-lane routing, not ceremony.

Smoke the enforcement (any runtime, any agent):

```bash
node .bee/bin/bee_cells.mjs claim --id anything --worker w1
# → refuses: gate "execution" is not approved  ✔ the helpers are armed
```

---

## 5. Update / uninstall

**Update:** pull/copy the new plugin version, then re-run onboarding per repo (`--apply`) — it detects drift via managed versions in `.bee/onboarding.json` and refreshes the AGENTS block + helpers. Plugin route: `/plugin update bee` (or re-add the marketplace) as well.

**Uninstall (per repo):** delete the BEE block (everything between and including the `BEE:START`/`BEE:END` markers) from `AGENTS.md`, remove `.bee/`, and — if `--repo-hooks` was used — remove the six `bee-*` entries from `.claude/settings.json`. `docs/history/` is yours; keep it.

**Uninstall (runtime):** `/plugin uninstall bee` on Claude Code, or delete the copied skill folders.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Skills don't appear | Plugin not enabled (`/plugin`), or manual copy went to the wrong skills dir; restart the session after installing |
| No session preamble in Claude Code | Repo not onboarded (`.bee/onboarding.json` missing — hooks self-arm only after onboarding), or hook disabled in `.bee/config.json → hooks.session-init` |
| `claim`/`cap` refuse unexpectedly | Working as designed: check `bee_status` for gate states — execution must be approved (Gate 3), cells must have a passing recorded verify before capping |
| Hook crash suspected | Hooks are fail-open; check `.bee/logs/hooks.jsonl` |
| `node` not found | Install Node 18+ and reopen the terminal/session |
