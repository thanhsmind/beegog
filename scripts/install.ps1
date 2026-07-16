# install.ps1 - install bee (https://github.com/thanhsmind/beegog) into a project.
#
# Two layers:
#   1. Runtime layer (opt-in, -GlobalSkills): copy the bee skills into your
#      agent's global skills directory (~/.claude/skills and/or ~/.codex/skills).
#      Off by default - the per-project sync in layer 2 is the default layout.
#   2. Repo layer: run onboard_bee.mjs against the target project - installs the
#      AGENTS.md BEE block, .bee/ runtime files, vendored helpers, and (by
#      default) syncs the bee skills per-project into <repo>/.claude/skills and
#      <repo>/.agents/skills.
#
# Greenfield (empty dir / no git) and brownfield (existing repo) are both
# supported: onboarding merges via BEE:START/END markers, never touches content
# outside them, never overwrites existing state, and is idempotent.
#
# Flags:
#   -GlobalSkills   Also copy bee skills into the legacy global runtime
#                   directories (~/.claude/skills, ~/.codex/skills) and pass
#                   --global-skills through to onboarding. Off by default -
#                   onboarding's per-project sync (layer 2) is the default.
#   -NoClaudeMd     Skip writing/extending CLAUDE.md with the bare @AGENTS.md
#                   import. By default onboarding writes it.
#   -ClaudeMd       Accepted for compatibility; a no-op alias of the default
#                   (CLAUDE.md is written unless -NoClaudeMd is passed).
#
# Examples:
#   .\scripts\install.ps1                                   # this checkout -> current dir
#   .\scripts\install.ps1 -Directory C:\proj -Yes           # non-interactive
#   .\scripts\install.ps1 -DryRun                           # plan only
#   .\scripts\install.ps1 -GlobalSkills -Yes                # also install skills globally
#   iwr -useb https://raw.githubusercontent.com/thanhsmind/beegog/main/scripts/install.ps1 -OutFile install-bee.ps1
#   .\install-bee.ps1 -Directory C:\proj -Yes

[CmdletBinding()]
param(
  [string]$Directory = (Get-Location).Path,
  [ValidateSet('claude', 'codex', 'both')]
  [string]$Runtime = 'both',
  [ValidateSet('plugin-first', 'repo-copy')]
  [string]$Distribution = 'repo-copy',
  [string]$PluginStateFile = '',
  [string]$OwnershipLedger = '',
  [string]$Source = '',
  [string]$Ref = 'main',
  [switch]$NoHooks,
  [switch]$GlobalSkills,
  [switch]$NoClaudeMd,
  [switch]$ClaudeMd,
  [switch]$NoGitInit,
  [switch]$Yes,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$RepoUrl = 'https://github.com/thanhsmind/beegog.git'

function Fail([string]$Message) { Write-Error $Message; exit 1 }

function Confirm-Step([string]$Question) {
  if ($Yes) { return $true }
  if (-not [Environment]::UserInteractive) {
    Fail "$Question - no interactive console. Re-run with -Yes to accept."
  }
  $answer = Read-Host "$Question [y/N]"
  return $answer -match '^(y|yes)$'
}

# ---------- prerequisites ----------

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) { Fail 'Node.js 18+ is required (node not found on PATH).' }
# Parse `node --version` in PowerShell itself: passing a quoted JS expression to
# `node -p` breaks in Windows PowerShell 5.1 (embedded quotes are stripped for
# native commands), which made this check fail even on new Node versions.
$nodeVersionRaw = (node --version | Select-Object -First 1).Trim()
$nodeMajor = 0
if ($nodeVersionRaw -match '^v?(\d+)') { $nodeMajor = [int]$Matches[1] }
if ($nodeMajor -lt 18) { Fail "Node.js 18+ is required (found $nodeVersionRaw)." }

# ---------- resolve bee source (local checkout or clone) ----------

$cleanupDir = $null
$stateTempDir = $null
try {
  if ($Source) {
    # .ProviderPath, not .Path: on UNC paths PS 5.1 returns a provider-qualified
    # string (Microsoft.PowerShell.Core\FileSystem::\\...) that node cannot open.
    $beeSrc = (Resolve-Path $Source).ProviderPath
  } elseif ($PSScriptRoot -and (Test-Path (Join-Path $PSScriptRoot '..\skills\bee-hive\scripts\onboard_bee.mjs'))) {
    $beeSrc = (Resolve-Path (Join-Path $PSScriptRoot '..')).ProviderPath
  } else {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
      Fail 'git is required to fetch bee (or pass -Source <local-checkout>).'
    }
    $cleanupDir = Join-Path ([IO.Path]::GetTempPath()) ("bee-install-" + [Guid]::NewGuid().ToString('N').Substring(0, 8))
    Write-Host "fetch    $RepoUrl (ref: $Ref)"
    $clonePath = Join-Path $cleanupDir 'bee'

    # Check out only the trees the installer reads. Windows rejects : * ? " < > | in
    # filenames, so a full checkout of any ref carrying such a path aborts the working
    # tree ("invalid path") and leaves an empty clone that fails much later. A sparse
    # checkout keeps the install working on every ref, historical tags included.
    # (Keep this file pure ASCII: the onboard test enforces it.)
    # No 2> redirection anywhere below: under Windows PowerShell 5.1 with
    # $ErrorActionPreference = 'Stop', redirecting a native command's stderr turns its
    # warnings into terminating NativeCommandErrors. Exit codes and the probe decide.
    git clone --quiet --depth 1 --branch $Ref --no-checkout $RepoUrl $clonePath
    if ($LASTEXITCODE -ne 0) { Fail 'Clone failed. Check network access to github.com/thanhsmind/beegog.' }

    # sparse-checkout needs git 2.25+; on older git it exits non-zero and the checkout
    # below is simply a full one (which may still trip over an invalid path; the probe
    # is what turns that into an honest error instead of a silent empty source).
    git -C $clonePath sparse-checkout set skills .claude-plugin docs/history/codex-harness-hardening
    git -C $clonePath checkout --quiet HEAD

    $beeSrc = $clonePath
    if (-not (Test-Path (Join-Path $beeSrc 'skills\bee-hive\scripts\onboard_bee.mjs'))) {
      Fail "Checkout of $RepoUrl (ref: $Ref) produced no skills/ tree. Update git to 2.25+ (sparse checkout), or pass -Source <local-checkout>."
    }
  }

  $onboard = Join-Path $beeSrc 'skills\bee-hive\scripts\onboard_bee.mjs'
  if (-not (Test-Path $onboard)) { Fail "Not a bee checkout (missing skills/bee-hive/scripts/onboard_bee.mjs): $beeSrc" }
  $distributionHelper = Join-Path $beeSrc 'skills\bee-hive\scripts\plugin_distribution.mjs'
  $releaseManifest = Join-Path $beeSrc 'docs\history\codex-harness-hardening\release-manifest.json'
  if (-not (Test-Path $distributionHelper)) { Fail "Not a bee release (missing plugin_distribution.mjs): $beeSrc" }
  if (-not (Test-Path $releaseManifest)) { Fail "Not a bee release (missing release manifest): $beeSrc" }
  $beeVersion = try {
    (Get-Content (Join-Path $beeSrc '.claude-plugin\plugin.json') -Raw | ConvertFrom-Json).version
  } catch { 'unknown' }
  Write-Host "source   $beeSrc (bee $beeVersion)"

  # Basename-only replacement of user/global roots is forbidden. The shared
  # planner consumes an exact ledger before any such cleanup.
  if ($GlobalSkills -and -not $OwnershipLedger) {
    Fail '-GlobalSkills requires -OwnershipLedger; basename-only global replacement is refused'
  }

  # ---------- layer 2: target repo (greenfield / brownfield) ----------

  if (-not (Test-Path $Directory)) {
    if ($DryRun) {
      Write-Host "would create  $Directory (greenfield)"
    } else {
      if (-not (Confirm-Step "Target $Directory does not exist. Create it (greenfield)?")) { Fail 'Aborted.' }
      New-Item -ItemType Directory -Force -Path $Directory | Out-Null
    }
  }
  if (Test-Path $Directory) { $Directory = (Resolve-Path $Directory).ProviderPath }

  $mode = 'brownfield'
  if (-not (Test-Path (Join-Path $Directory '.git'))) {
    $mode = 'greenfield'
    if (-not $NoGitInit) {
      if ($DryRun) {
        Write-Host "would run     git init ($Directory is not a git repo)"
      } elseif ((Get-Command git -ErrorAction SilentlyContinue) -and (Confirm-Step "No git repo at $Directory. Run git init?")) {
        git -C $Directory init --quiet
      }
    }
  } elseif (Test-Path (Join-Path $Directory '.bee\onboarding.json')) {
    $mode = 'brownfield (bee already onboarded - refresh)'
  } elseif ((Test-Path (Join-Path $Directory 'AGENTS.md')) -or (Test-Path (Join-Path $Directory 'CLAUDE.md'))) {
    $mode = 'brownfield (existing agent docs - BEE block will be merged, nothing outside markers touched)'
  }
  Write-Host "target   $Directory [$mode]"

  $onboardFlags = @()
  if ($Distribution -eq 'plugin-first') { $onboardFlags += '--plugin-source' }
  elseif (-not $NoHooks) { $onboardFlags += '--repo-hooks' }
  if ($NoClaudeMd) { $onboardFlags += '--no-claude-md' }
  if ($ClaudeMd) { $onboardFlags += '--claude-md' }
  if ($GlobalSkills) { $onboardFlags += '--global-skills' }

  if ($PluginStateFile) {
    if (-not (Test-Path $PluginStateFile)) { Fail "-PluginStateFile not found: $PluginStateFile" }
    $stateFile = (Resolve-Path $PluginStateFile).ProviderPath
  } else {
    $stateTempDir = Join-Path ([IO.Path]::GetTempPath()) ("bee-plugin-state-" + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $stateTempDir | Out-Null
    $claudeStatePath = Join-Path $stateTempDir 'claude.json'
    $codexStatePath = Join-Path $stateTempDir 'codex.json'
    Set-Content -Encoding ASCII -Path $claudeStatePath -Value '[]'
    Set-Content -Encoding ASCII -Path $codexStatePath -Value '[]'

    if ($Runtime -in @('codex', 'both')) {
      $codex = Get-Command codex -ErrorAction SilentlyContinue
      if ($codex) {
        if (-not $DryRun) {
          if ($Distribution -eq 'plugin-first') {
            # Mutation verbs take NO --json (only `plugin list` does); the real
            # CLI rejects `--json` here with `error: unknown option '--json'`.
            & codex plugin marketplace add $beeSrc | Out-Null
            if ($LASTEXITCODE -ne 0) { Fail 'Codex marketplace registration failed' }
            & codex plugin add 'bee@bee' | Out-Null
            if ($LASTEXITCODE -ne 0) { Fail 'Codex bee plugin install failed' }
          } else {
            & codex plugin remove 'bee@bee' | Out-Null
          }
        }
        $codexList = & codex plugin list --json
        if ($LASTEXITCODE -ne 0) { Fail 'Codex plugin status probe failed' }
        Set-Content -Encoding UTF8 -Path $codexStatePath -Value ($codexList -join "`n")
      } elseif ($Distribution -eq 'plugin-first') { Fail 'Codex CLI is required for plugin-first' }
    }

    if ($Runtime -in @('claude', 'both')) {
      $claude = Get-Command claude -ErrorAction SilentlyContinue
      if ($claude) {
        if (-not $DryRun) {
          if ($Distribution -eq 'plugin-first') {
            & claude plugin marketplace add $beeSrc | Out-Null
            if ($LASTEXITCODE -ne 0) { Fail 'Claude marketplace registration failed' }
            & claude plugin install 'bee@bee' | Out-Null
            if ($LASTEXITCODE -ne 0) { Fail 'Claude bee plugin install failed' }
          } else {
            & claude plugin uninstall 'bee@bee' | Out-Null
          }
        }
        $claudeList = & claude plugin list --json
        if ($LASTEXITCODE -ne 0) { Fail 'Claude plugin status probe failed' }
        Set-Content -Encoding UTF8 -Path $claudeStatePath -Value ($claudeList -join "`n")
      } elseif ($Distribution -eq 'plugin-first') { Fail 'Claude CLI is required for plugin-first' }
    }

    $combined = @{ claude = (Get-Content $claudeStatePath -Raw | ConvertFrom-Json); codex = (Get-Content $codexStatePath -Raw | ConvertFrom-Json) }
    $stateFile = Join-Path $stateTempDir 'state.json'
    Set-Content -Encoding UTF8 -Path $stateFile -Value ($combined | ConvertTo-Json -Depth 100)
  }

  $distributionArgs = @('--mode', $Distribution, '--runtime', $Runtime, '--repo-root', $Directory, '--release-manifest', $releaseManifest, '--plugin-state-file', $stateFile)
  if ($OwnershipLedger) { $distributionArgs += @('--ledger', $OwnershipLedger) }
  if ($GlobalSkills) {
    $claudeHome = if ($env:CLAUDE_HOME) { $env:CLAUDE_HOME } else { Join-Path $HOME '.claude' }
    $codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME '.codex' }
    if ($Runtime -in @('claude', 'both')) { $distributionArgs += @('--user-skill-root', (Join-Path $claudeHome 'skills')) }
    if ($Runtime -in @('codex', 'both')) { $distributionArgs += @('--user-skill-root', (Join-Path $codexHome 'skills')) }
  }

  node $distributionHelper @distributionArgs
  if ($LASTEXITCODE -ne 0) { Fail 'Distribution preflight refused' }

  Write-Host "plan     onboard_bee.mjs $($onboardFlags -join ' ') (dry-run first)"
  node $onboard --repo-root $Directory @onboardFlags
  if ($LASTEXITCODE -ne 0) { Fail 'Onboarding plan failed.' }

  if ($DryRun) {
    Write-Host 'dry-run  nothing written. Re-run without -DryRun to apply.'
    exit 0
  }

  if (-not (Confirm-Step "Apply this onboarding plan to $Directory?")) { Fail 'Aborted - nothing applied.' }
  node $onboard --repo-root $Directory --apply @onboardFlags | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail 'Onboarding apply failed.' }

  if ($Distribution -eq 'plugin-first') {
    node $distributionHelper @distributionArgs --apply
    if ($LASTEXITCODE -ne 0) { Fail 'Plugin-first cleanup refused; repository fallbacks were preserved' }
  }

  # ---------- verify ----------

  Push-Location $Directory
  try {
    $statusJson = node .bee\bin\bee.mjs status --json
    if ($LASTEXITCODE -ne 0) { Fail 'Verification failed: bee.mjs status did not run.' }
    # Join first: PS 5.1 pipes a multi-line array into ConvertFrom-Json line by line.
    $status = ($statusJson -join "`n") | ConvertFrom-Json
    if (-not $status.onboarding -or $status.onboarding.installed -ne $true) {
      Fail 'Verification failed: bee.mjs status reports not installed.'
    }
    $expectedVersion = (Get-Content (Join-Path $beeSrc '.claude-plugin\plugin.json') -Raw | ConvertFrom-Json).version
    if ($status.onboarding.bee_version -ne $expectedVersion -or
        $status.onboarding.plugin_version -ne $expectedVersion -or
        $status.onboarding.drift -ne $false) {
      Fail "Verification failed: version parity mismatch (expected $expectedVersion; bee $($status.onboarding.bee_version), plugin $($status.onboarding.plugin_version), drift $($status.onboarding.drift))."
    }
    Write-Host "verify   onboarding ok (bee $($status.onboarding.bee_version)), phase: $($status.phase)"
  } finally {
    Pop-Location
  }

  Write-Host ''
  Write-Host 'bee installed.'
  Write-Host "  next: open an agent session in $Directory"
  Write-Host '  - Claude Code: the session preamble appears via hooks; or say "Route this through bee: <task>"'
  Write-Host '  - Codex: the AGENTS.md BEE block bootstraps; first step is bee.mjs status'
  Write-Host '  - scout any time: node .bee/bin/bee.mjs status --json'
} finally {
  if ($cleanupDir -and (Test-Path $cleanupDir)) {
    Remove-Item -Recurse -Force $cleanupDir -ErrorAction SilentlyContinue
  }
  if ($stateTempDir -and (Test-Path $stateTempDir)) {
    Remove-Item -Recurse -Force $stateTempDir -ErrorAction SilentlyContinue
  }
}
