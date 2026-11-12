<#
.SYNOPSIS
  CC-26 QA runner for the Nextwise Development-QA Supabase project ONLY
  (ynwzijulzksmrcwdhudv). Each step needs its own written approval.

.DESCRIPTION
  -Step Preflight  supabase/migrations-proposed/cc26/cc26_qa_preflight_readonly.sql
                   One READ ONLY transaction, rolled back. Counts and booleans only.   (Approval 1)
  -Step Apply      cc25/0023 (revision 2), cc25/0024, cc26/0025 — and cc26/0026 only
                   with -IncludeCheckoutGate. Each file is one atomic transaction that
                   checks its own pre- and postconditions.                            (Approval 2; 0026: Approval 3)
  -Step Tests      cc25/0023_cc25_rls_tests.sql (89 checks) and cc26/cc26_security_tests.sql.
                   Fictional fixtures inside ONE transaction that is always rolled back:
                   nothing is left behind. Exit code is non-zero if any check fails.   (Approval 2)
  -Step Rollback   0026 -> 0025 -> 0024 -> 0023 rollback files (only those applied).  (separate approval)

  Guards (all steps):
  - host/user must contain the QA ref; anything naming production bwlkxunujngksibfzzfv is refused;
  - port 5432 only (single session); psql from PATH; never a linked Supabase CLI;
  - you type the QA ref; write steps also need a typed phrase;
  - the password is read without echo, passed through a process-only variable and cleared.
  Output is saved next to this script as cc26-qa-<step>-<timestamp>.txt.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\Run-CC26-Qa.ps1 -Step Preflight `
    -DbHost aws-0-<region>.pooler.supabase.com -DbUser postgres.ynwzijulzksmrcwdhudv
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][ValidateSet('Preflight', 'Apply', 'Tests', 'Rollback')][string]$Step,
    [Parameter(Mandatory = $true)][string]$DbHost,
    [Parameter(Mandatory = $true)][string]$DbUser,
    [switch]$IncludeCheckoutGate,
    [int]$Port = 5432,
    [string]$Database = 'postgres'
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$QaRef = 'ynwzijulzksmrcwdhudv'
$ProdRef = 'bwlkxunujngksibfzzfv'
$Approved = 'APPROVED-QA-ynwzijulzksmrcwdhudv'

try {
    $target = ($DbHost + ' ' + $DbUser).ToLowerInvariant()
    if ($target.Contains($ProdRef)) { throw 'Refusing: the target names the PRODUCTION project.' }
    if (-not $target.Contains($QaRef)) { throw "Refusing: neither host nor user contains the QA project ref $QaRef." }
    if ($Port -ne 5432) { throw 'Use the session pooler or direct connection on port 5432 (one session is required).' }
    $psql = Get-Command psql -ErrorAction SilentlyContinue
    if ($null -eq $psql) { throw 'psql was not found on PATH. Install the PostgreSQL client tools first.' }

    $repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
    $p = Join-Path $repo 'supabase\migrations-proposed'
    $settings = @()
    $files = @()
    $phrase = $null
    switch ($Step) {
        'Preflight' {
            $files = @("$p\cc26\cc26_qa_preflight_readonly.sql")
        }
        'Apply' {
            $settings = @(
                "select set_config('nextwise.cc25_0023_approval', '$Approved', false)",
                "select set_config('nextwise.cc25_0024_approval', '$Approved', false)",
                "select set_config('nextwise.cc26_0025_approval', '$Approved', false)")
            $files = @("$p\cc25\0023_cc25_counsellor_identity_least_privilege.sql",
                       "$p\cc25\0024_cc25_revoke_anon_internal_rpcs.sql",
                       "$p\cc26\0025_cc26_inactive_counsellor_and_grant_hardening.sql")
            if ($IncludeCheckoutGate) {
                $settings += "select set_config('nextwise.cc26_0026_approval', '$Approved', false)"
                $files += "$p\cc26\0026_cc26_database_checkout_gate.sql"
            }
            $phrase = 'APPLY CC-26 TO QA'
        }
        'Tests' {
            $settings = @("select set_config('nextwise.cc25_test_target', 'QA-$QaRef', false)",
                          "select set_config('nextwise.cc26_test_target', 'QA-$QaRef', false)")
            $files = @("$p\cc25\0023_cc25_rls_tests.sql", "$p\cc26\cc26_security_tests.sql")
        }
        'Rollback' {
            $settings = @(
                "select set_config('nextwise.cc26_0026_rollback', '$Approved', false)",
                "select set_config('nextwise.cc26_0025_rollback', '$Approved', false)",
                "select set_config('nextwise.cc25_0024_rollback', '$Approved', false)",
                "select set_config('nextwise.cc25_0023_rollback', '$Approved', false)")
            $files = @()
            if ($IncludeCheckoutGate) { $files += "$p\cc26\0026_cc26_ROLLBACK.sql" }
            $files += @("$p\cc26\0025_cc26_ROLLBACK.sql", "$p\cc25\0024_cc25_ROLLBACK.sql", "$p\cc25\0023_cc25_ROLLBACK.sql")
            $phrase = 'ROLL BACK CC-26 ON QA'
        }
    }
    foreach ($f in $files) { if (-not (Test-Path -LiteralPath $f)) { throw "Missing $f" } }

    Write-Host "Target: QA project $QaRef via $DbHost (user $DbUser). Step: $Step" -ForegroundColor Cyan
    foreach ($f in $files) { Write-Host ("  " + $f.Substring($repo.Length + 1)) }
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
    foreach ($s in $settings) { $psqlArgs += @('-c', $s) }
    foreach ($f in $files) { $psqlArgs += @('-f', $f) }
    try {
        $env:PGPASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
        $env:PGSSLMODE = 'require'
        $env:PGAPPNAME = 'nextwise-cc26-qa-' + $Step.ToLowerInvariant()
        $ErrorActionPreference = 'Continue'
        & $psql.Source @psqlArgs 2>&1 | Tee-Object -FilePath $out
        $code = $LASTEXITCODE
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
