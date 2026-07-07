# install.ps1 — install bee (https://github.com/thanhsmind/beegog) into a project.
#
# Two layers:
#   1. Runtime layer: copy the bee skills into your agent's skills directory
#      (~/.claude/skills and/or ~/.codex/skills).
#   2. Repo layer: run onboard_bee.mjs against the target project — installs the
#      AGENTS.md BEE block, .bee/ runtime files, and vendored helpers.
#
# Greenfield (empty dir / no git) and brownfield (existing repo) are both
# supported: onboarding merges via BEE:START/END markers, never touches content
# outside them, never overwrites existing state, and is idempotent.
#
# Examples:
#   .\scripts\install.ps1                                   # this checkout -> current dir
#   .\scripts\install.ps1 -Directory C:\proj -Yes           # non-interactive
#   .\scripts\install.ps1 -DryRun                           # plan only
#   iwr -useb https://raw.githubusercontent.com/thanhsmind/beegog/main/scripts/install.ps1 -OutFile install-bee.ps1
#   .\install-bee.ps1 -Directory C:\proj -Yes

[CmdletBinding()]
param(
  [string]$Directory = (Get-Location).Path,
  [ValidateSet('claude', 'codex', 'both')]
  [string]$Runtime = 'both',
  [string]$Source = '',
  [string]$Ref = 'main',
  [switch]$NoHooks,
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
    Fail "$Question — no interactive console. Re-run with -Yes to accept."
  }
  $answer = Read-Host "$Question [y/N]"
  return $answer -match '^(y|yes)$'
}

# ---------- prerequisites ----------

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) { Fail 'Node.js 18+ is required (node not found on PATH).' }
$nodeMajor = [int](node -p 'process.versions.node.split(".")[0]')
if ($nodeMajor -lt 18) { Fail "Node.js 18+ is required (found $(node --version))." }

# ---------- resolve bee source (local checkout or clone) ----------

$cleanupDir = $null
try {
  if ($Source) {
    $beeSrc = (Resolve-Path $Source).Path
  } elseif ($PSScriptRoot -and (Test-Path (Join-Path $PSScriptRoot '..\skills\bee-hive\scripts\onboard_bee.mjs'))) {
    $beeSrc = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
  } else {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
      Fail 'git is required to fetch bee (or pass -Source <local-checkout>).'
    }
    $cleanupDir = Join-Path ([IO.Path]::GetTempPath()) ("bee-install-" + [Guid]::NewGuid().ToString('N').Substring(0, 8))
    Write-Host "fetch    $RepoUrl (ref: $Ref)"
    git clone --quiet --depth 1 --branch $Ref $RepoUrl (Join-Path $cleanupDir 'bee')
    if ($LASTEXITCODE -ne 0) { Fail 'Clone failed. Check network access to github.com/thanhsmind/beegog.' }
    $beeSrc = Join-Path $cleanupDir 'bee'
  }

  $onboard = Join-Path $beeSrc 'skills\bee-hive\scripts\onboard_bee.mjs'
  if (-not (Test-Path $onboard)) { Fail "Not a bee checkout (missing skills/bee-hive/scripts/onboard_bee.mjs): $beeSrc" }
  $beeVersion = try {
    (Get-Content (Join-Path $beeSrc '.claude-plugin\plugin.json') -Raw | ConvertFrom-Json).version
  } catch { 'unknown' }
  Write-Host "source   $beeSrc (bee $beeVersion)"

  # ---------- layer 1: runtime skills ----------

  function Install-Skills([string]$Dest, [string]$Label) {
    $copied = 0; $updated = 0; $same = 0
    New-Item -ItemType Directory -Force -Path $Dest | Out-Null
    foreach ($skill in Get-ChildItem -Directory (Join-Path $beeSrc 'skills')) {
      $target = Join-Path $Dest $skill.Name
      if (Test-Path $target) {
        $srcFiles = Get-ChildItem -Recurse -File $skill.FullName | Sort-Object { $_.FullName.Substring($skill.FullName.Length) }
        $dstFiles = Get-ChildItem -Recurse -File $target | Sort-Object { $_.FullName.Substring($target.Length) }
        $identical = ($srcFiles.Count -eq $dstFiles.Count)
        if ($identical) {
          for ($i = 0; $i -lt $srcFiles.Count; $i++) {
            if (($srcFiles[$i].FullName.Substring($skill.FullName.Length) -ne $dstFiles[$i].FullName.Substring($target.Length)) -or
                ((Get-FileHash $srcFiles[$i].FullName).Hash -ne (Get-FileHash $dstFiles[$i].FullName).Hash)) {
              $identical = $false; break
            }
          }
        }
        if ($identical) { $same++; continue }
        if ($DryRun) { Write-Host "would update  $Label/$($skill.Name)"; $updated++; continue }
        Remove-Item -Recurse -Force $target
        Copy-Item -Recurse $skill.FullName $target
        $updated++
      } else {
        if ($DryRun) { Write-Host "would copy    $Label/$($skill.Name)"; $copied++; continue }
        Copy-Item -Recurse $skill.FullName $target
        $copied++
      }
    }
    Write-Host "skills   ${Label}: $copied new, $updated updated, $same unchanged"
  }

  $claudeHome = if ($env:CLAUDE_HOME) { $env:CLAUDE_HOME } else { Join-Path $HOME '.claude' }
  $codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME '.codex' }
  if ($Runtime -in @('claude', 'both')) { Install-Skills (Join-Path $claudeHome 'skills') '~/.claude/skills' }
  if ($Runtime -in @('codex', 'both')) { Install-Skills (Join-Path $codexHome 'skills') '~/.codex/skills' }
  if ($Runtime -in @('claude', 'both')) {
    Write-Host 'note     prefer the Claude Code plugin route when available:'
    Write-Host '         /plugin marketplace add thanhsmind/beegog  ->  /plugin install bee@bee'
    Write-Host '         (plugin route ships hooks automatically; this copy route wires repo hooks instead)'
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
  if (Test-Path $Directory) { $Directory = (Resolve-Path $Directory).Path }

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
    $mode = 'brownfield (bee already onboarded — refresh)'
  } elseif ((Test-Path (Join-Path $Directory 'AGENTS.md')) -or (Test-Path (Join-Path $Directory 'CLAUDE.md'))) {
    $mode = 'brownfield (existing agent docs — BEE block will be merged, nothing outside markers touched)'
  }
  Write-Host "target   $Directory [$mode]"

  $onboardFlags = @()
  if ((-not $NoHooks) -and ($Runtime -in @('claude', 'both'))) { $onboardFlags += '--repo-hooks' }
  if ($ClaudeMd) { $onboardFlags += '--claude-md' }

  Write-Host "plan     onboard_bee.mjs $($onboardFlags -join ' ') (dry-run first)"
  node $onboard --repo-root $Directory @onboardFlags
  if ($LASTEXITCODE -ne 0) { Fail 'Onboarding plan failed.' }

  if ($DryRun) {
    Write-Host 'dry-run  nothing written. Re-run without -DryRun to apply.'
    exit 0
  }

  if (-not (Confirm-Step "Apply this onboarding plan to $Directory?")) { Fail 'Aborted — nothing applied.' }
  node $onboard --repo-root $Directory --apply @onboardFlags | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail 'Onboarding apply failed.' }

  # ---------- verify ----------

  Push-Location $Directory
  try {
    $statusJson = node .bee\bin\bee_status.mjs --json
    if ($LASTEXITCODE -ne 0) { Fail 'Verification failed: bee_status did not run.' }
    $status = $statusJson | ConvertFrom-Json
    if (-not $status.onboarding -or $status.onboarding.installed -ne $true) {
      Fail 'Verification failed: bee_status reports not installed.'
    }
    Write-Host "verify   onboarding ok (bee $($status.onboarding.bee_version)), phase: $($status.phase)"
  } finally {
    Pop-Location
  }

  Write-Host ''
  Write-Host 'bee installed.'
  Write-Host "  next: open an agent session in $Directory"
  Write-Host '  - Claude Code: the session preamble appears via hooks; or say "Route this through bee: <task>"'
  Write-Host '  - Codex: the AGENTS.md BEE block bootstraps; first step is bee_status'
  Write-Host '  - scout any time: node .bee/bin/bee_status.mjs --json'
} finally {
  if ($cleanupDir -and (Test-Path $cleanupDir)) {
    Remove-Item -Recurse -Force $cleanupDir -ErrorAction SilentlyContinue
  }
}
