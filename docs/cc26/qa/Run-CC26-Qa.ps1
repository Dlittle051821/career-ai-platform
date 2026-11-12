<#
.SYNOPSIS
  CC-26 QA runner for the Nextwise Development-QA Supabase project ONLY
  (ynwzijulzksmrcwdhudv). Each step needs its own written approval.

.DESCRIPTION
  -Step Preflight  supabase/migrations-proposed/cc26/cc26_qa_preflight_readonly.sql
                   One READ ONLY transaction, rolled back. Counts and booleans only.   (Approval 1)
  -Step Export     cc26/cc26_qa_export_readonly.sql: every function, policy, grant,
                   trigger and constraint definition (no rows). READ ONLY.           (Approval 1)
  -Step Backup     pg_dump --schema-only of schemas public and nextwise_security (no rows) into
                   this folder, then checks the dump and prints its SHA-256. Read-only.
                   It is the catalog restore point; it is NOT a data backup.         (Approval 1)
  -Step Apply      cc25/0023 (revision 2), cc25/0024, cc26/0025 — and cc26/0026 only
                   with -IncludeCheckoutGate. Each file is one atomic transaction that
                   checks its own pre- and postconditions.                            (Approval 2; 0026: Approval 3)
  -Step Tests      cc25/0023_cc25_rls_tests.sql (89 checks) and cc26/cc26_security_tests.sql.
                   Fictional fixtures inside ONE transaction that is always rolled back:
                   nothing is left behind. Exit code is non-zero if any check fails.   (Approval 2)
  -Step Rollback   0026 -> 0025 -> 0024 -> 0023 rollback files (only those applied).  (separate approval)

  Where the SQL comes from: the CC-26 WORKTREE, never the folder this script sits in.
  The script may run from the worktree (docs\cc26\qa) or from the milestone copy
  (C:\ClaudeBuilds\Milestones\CC26-LAUNCH-READINESS\docs\qa). The worktree is, in order:
  -RepoRoot if given; else the nearest parent folder of this script that is a git worktree
  containing supabase\migrations-proposed\cc26; else C:\ClaudeBuilds\CC26-LAUNCH-READINESS.
  It is then validated before anything connects: a git worktree on branch
  cc26/launch-readiness, never C:\carrier.ai, with every SQL file present, committed and
  unmodified (git status clean for those paths), and matching its pinned hash.

  Guards (all steps):
  - every SQL file must match its SHA-256 (CRLF normalised to LF) in the worktree's
    docs\cc26\qa\CC26-QA-SQL-SHA256.txt, the hashes quoted in the approval report (CC26-13);
  - host/user must contain the QA ref; anything naming production bwlkxunujngksibfzzfv is refused;
  - port 5432 only (single session); psql from PATH; never a linked Supabase CLI;
  - you type the QA ref; write steps also need a typed phrase;
  - the password is read without echo, passed through a process-only variable and cleared.
  Output is saved next to this script as cc26-qa-<step>-<timestamp>.txt.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\Run-CC26-Qa.ps1 -Step Preflight `
    -DbHost aws-0-<region>.pooler.supabase.com -DbUser postgres.ynwzijulzksmrcwdhudv
  (optional: -RepoRoot C:\ClaudeBuilds\CC26-LAUNCH-READINESS)
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][ValidateSet('Preflight', 'Export', 'Backup', 'Apply', 'Tests', 'Rollback')][string]$Step,
    [Parameter(Mandatory = $true)][string]$DbHost,
    [Parameter(Mandatory = $true)][string]$DbUser,
    [switch]$IncludeCheckoutGate,
    [int]$Port = 5432,
    [string]$Database = 'postgres',
    [string]$RepoRoot = ''
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$QaRef = 'ynwzijulzksmrcwdhudv'
$ProdRef = 'bwlkxunujngksibfzzfv'
$Approved = 'APPROVED-QA-ynwzijulzksmrcwdhudv'
$Branch = 'cc26/launch-readiness'
$DefaultRepo = 'C:\ClaudeBuilds\CC26-LAUNCH-READINESS'
$Mig = 'supabase/migrations-proposed'

# Path from a root and a '/'-separated relative path (works with any separator).
function Join-Rel([string]$Root, [string]$Rel) {
    $p = $Root
    foreach ($part in ($Rel -split '/')) { $p = [System.IO.Path]::Combine($p, $part) }
    return $p
}
function Test-Worktree([string]$Dir) {
    return (Test-Path -LiteralPath (Join-Path $Dir '.git')) -and (Test-Path -LiteralPath (Join-Rel $Dir "$Mig/cc26") -PathType Container)
}
function Resolve-Worktree {
    if ($RepoRoot) { return (Resolve-Path -LiteralPath $RepoRoot).Path }
    $d = $PSScriptRoot
    while ($d) {
        if (Test-Worktree $d) { return $d }
        $parent = Split-Path -Parent $d
        if (-not $parent -or $parent -eq $d) { break }
        $d = $parent
    }
    if (Test-Path -LiteralPath $DefaultRepo) { return (Resolve-Path -LiteralPath $DefaultRepo).Path }
    throw "CC-26 worktree not found. Pass -RepoRoot <path to the cc26/launch-readiness worktree>."
}
function Invoke-GitText([string[]]$GitArgs) {
    $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { $out = & git @GitArgs 2>$null; return [pscustomobject]@{ Code = $LASTEXITCODE; Text = (($out | Out-String).Trim()) } }
    finally { $ErrorActionPreference = $prev }
}

# SHA-256 of a text file with CRLF normalised to LF (the worktree is CRLF on
# Windows; the approval report quotes LF hashes, identical to the Git blobs).
function Get-LfSha256([string]$Path) {
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $text = [System.IO.File]::ReadAllText($Path, $utf8).Replace("`r`n", "`n")
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return (($sha.ComputeHash($utf8.GetBytes($text)) | ForEach-Object { $_.ToString('x2') }) -join '') }
    finally { $sha.Dispose() }
}

try {
    $target = ($DbHost + ' ' + $DbUser).ToLowerInvariant()
    if ($target.Contains($ProdRef)) { throw 'Refusing: the target names the PRODUCTION project.' }
    if (-not $target.Contains($QaRef)) { throw "Refusing: neither host nor user contains the QA project ref $QaRef." }
    if ($Port -ne 5432) { throw 'Use the session pooler or direct connection on port 5432 (one session is required).' }
    $psql = Get-Command psql -ErrorAction SilentlyContinue
    if ($null -eq $psql) { throw 'psql was not found on PATH. Install the PostgreSQL client tools first.' }

    # Locate and validate the CC-26 worktree (not the folder this script is in).
    $repo = (Resolve-Worktree).TrimEnd('\', '/')
    if ($repo.TrimEnd('\', '/') -ieq 'C:\carrier.ai') { throw 'Refusing: C:\carrier.ai is not the CC-26 worktree.' }
    if (-not (Test-Worktree $repo)) { throw "Refusing: $repo is not a git worktree containing $Mig/cc26." }
    if ($null -eq (Get-Command git -ErrorAction SilentlyContinue)) { throw 'git was not found on PATH (needed to validate the worktree).' }
    $gitBranch = Invoke-GitText @('-C', $repo, 'rev-parse', '--abbrev-ref', 'HEAD')
    if ($gitBranch.Code -ne 0 -or $gitBranch.Text -ne $Branch) { throw "Refusing: $repo is on branch '$($gitBranch.Text)', not $Branch." }
    $gitHead = (Invoke-GitText @('-C', $repo, 'rev-parse', 'HEAD')).Text
    $p = Join-Rel $repo $Mig
    $settings = @()
    $files = @()
    $phrase = $null
    switch ($Step) {
        'Preflight' {
            $files = @((Join-Rel $p "cc26/cc26_qa_preflight_readonly.sql"))
        }
        'Export' {
            $files = @((Join-Rel $p "cc26/cc26_qa_export_readonly.sql"))
        }
        'Backup' {
            $files = @()
        }
        'Apply' {
            $settings = @(
                "select set_config('nextwise.cc25_0023_approval', '$Approved', false)",
                "select set_config('nextwise.cc25_0024_approval', '$Approved', false)",
                "select set_config('nextwise.cc26_0025_approval', '$Approved', false)")
            $files = @((Join-Rel $p "cc25/0023_cc25_counsellor_identity_least_privilege.sql"),
                       (Join-Rel $p "cc25/0024_cc25_revoke_anon_internal_rpcs.sql"),
                       (Join-Rel $p "cc26/0025_cc26_inactive_counsellor_and_grant_hardening.sql"))
            if ($IncludeCheckoutGate) {
                $settings += "select set_config('nextwise.cc26_0026_approval', '$Approved', false)"
                $files += (Join-Rel $p "cc26/0026_cc26_database_checkout_gate.sql")
            }
            $phrase = 'APPLY CC-26 TO QA'
        }
        'Tests' {
            $settings = @("select set_config('nextwise.cc25_test_target', 'QA-$QaRef', false)",
                          "select set_config('nextwise.cc26_test_target', 'QA-$QaRef', false)")
            $files = @((Join-Rel $p "cc25/0023_cc25_rls_tests.sql"), (Join-Rel $p "cc26/cc26_security_tests.sql"))
        }
        'Rollback' {
            $settings = @(
                "select set_config('nextwise.cc26_0026_rollback', '$Approved', false)",
                "select set_config('nextwise.cc26_0025_rollback', '$Approved', false)",
                "select set_config('nextwise.cc25_0024_rollback', '$Approved', false)",
                "select set_config('nextwise.cc25_0023_rollback', '$Approved', false)")
            $files = @()
            if ($IncludeCheckoutGate) { $files += (Join-Rel $p "cc26/0026_cc26_ROLLBACK.sql") }
            $files += @((Join-Rel $p "cc26/0025_cc26_ROLLBACK.sql"), (Join-Rel $p "cc25/0024_cc25_ROLLBACK.sql"), (Join-Rel $p "cc25/0023_cc25_ROLLBACK.sql"))
            $phrase = 'ROLL BACK CC-26 ON QA'
        }
    }
    foreach ($f in $files) { if (-not (Test-Path -LiteralPath $f)) { throw "Missing $f" } }

    # Pin every SQL file to the hash in the approval report (the worktree's committed copy).
    $manifest = Join-Rel $repo 'docs/cc26/qa/CC26-QA-SQL-SHA256.txt'
    if (-not (Test-Path -LiteralPath $manifest)) { throw "Missing $manifest" }
    $pinned = @{}
    foreach ($line in [System.IO.File]::ReadAllLines($manifest)) {
        if ($line -match '^([0-9a-f]{64})  (\S+)$') { $pinned[$Matches[2]] = $Matches[1] }
    }
    Write-Host "Target: QA project $QaRef via $DbHost (user $DbUser). Step: $Step" -ForegroundColor Cyan
    Write-Host "Worktree: $repo  branch $Branch  HEAD $gitHead"
    $relPaths = @($files | ForEach-Object { $_.Substring($repo.Length + 1).Replace('\', '/') })
    if ($relPaths.Count -gt 0) {
        $dirty = Invoke-GitText (@('-C', $repo, 'status', '--porcelain', '--untracked-files=all', '--') + $relPaths)
        if ($dirty.Code -ne 0) { throw 'git status failed in the worktree.' }
        if ($dirty.Text) { throw "Refusing: SQL files are uncommitted or modified in the worktree:`n$($dirty.Text)" }
    }
    foreach ($f in $files) {
        $rel = $f.Substring($repo.Length + 1).Replace('\', '/')
        $h = Get-LfSha256 $f
        if (-not $pinned.ContainsKey($rel)) { throw "Refusing: $rel is not listed in CC26-QA-SQL-SHA256.txt." }
        if ($pinned[$rel] -ne $h) { throw "Refusing: $rel does not match its approved SHA-256 (expected $($pinned[$rel]), found $h)." }
        Write-Host ("  " + $rel + "  sha256 " + $h)
    }
    $typed = Read-Host 'Type the QA project ref to confirm'
    if ($typed -ne $QaRef) { throw 'Confirmation did not match. Nothing was run.' }
    if ($phrase) {
        $typed2 = Read-Host "This step WRITES to the QA database. Type: $phrase"
        if ($typed2 -ne $phrase) { throw 'Confirmation phrase did not match. Nothing was run.' }
    }
    $secure = Read-Host 'QA database password (not shown)' -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $out = Join-Path $PSScriptRoot ('cc26-qa-' + $Step.ToLowerInvariant() + '-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.txt')
    $psqlArgs = @('-X', '-h', $DbHost, '-p', $Port, '-U', $DbUser, '-d', $Database, '-v', 'ON_ERROR_STOP=1')
    if ($Step -eq 'Export') { $psqlArgs += @('-A', '-P', 'footer=off') }
    foreach ($s in $settings) { $psqlArgs += @('-c', $s) }
    foreach ($f in $files) { $psqlArgs += @('-f', $f) }
    try {
        $env:PGPASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
        $env:PGSSLMODE = 'require'
        $env:PGAPPNAME = 'nextwise-cc26-qa-' + $Step.ToLowerInvariant()
        $ErrorActionPreference = 'Continue'
        if ($Step -eq 'Backup') {
            $pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
            if ($null -eq $pgDump) { throw 'pg_dump was not found on PATH (it ships with psql).' }
            $dump = Join-Path $PSScriptRoot ('cc26-qa-schema-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.sql')
            & $pgDump.Source -h $DbHost -p $Port -U $DbUser -d $Database --schema-only -n public -n nextwise_security -f $dump 2>&1 | Tee-Object -FilePath $out
            $code = $LASTEXITCODE
            if ($code -eq 0) {
                $dumpText = [System.IO.File]::ReadAllText($dump)
                $checks = @('CREATE FUNCTION public.current_counsellor_id()', 'CREATE TABLE public.discovery_sessions', 'CREATE POLICY')
                foreach ($c in $checks) { if (-not $dumpText.Contains($c)) { $code = 3; Add-Content -LiteralPath $out "Backup check failed: '$c' not found in the dump." } }
                $dumpHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $dump).Hash.ToLowerInvariant()
                Add-Content -LiteralPath $out "Schema dump: $dump  sha256 $dumpHash  bytes $((Get-Item -LiteralPath $dump).Length)"
                Write-Host "Schema dump: $dump  sha256 $dumpHash"
            }
        } else {
            & $psql.Source @psqlArgs 2>&1 | Tee-Object -FilePath $out
            $code = $LASTEXITCODE
        }
        $ErrorActionPreference = 'Stop'
    } finally {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    if ($code -ne 0) { throw "psql exited with $code (a failed check or a refused precondition). See $out" }
    Write-Host "$Step finished. Output: $out" -ForegroundColor Green
    exit 0
} catch {
    Write-Host "REFUSED/FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
