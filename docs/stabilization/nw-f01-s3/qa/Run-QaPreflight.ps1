<#
.SYNOPSIS
  Runs CC18-QA-PREFLIGHT.sql (read-only) against the Nextwise Development-QA
  Supabase project ONLY. Do not run until the preflight is approved.

.DESCRIPTION
  - Connects only to an explicitly given host/user that contain the QA project
    ref ynwzijulzksmrcwdhudv; refuses anything containing the production ref
    bwlkxunujngksibfzzfv. Never uses a linked Supabase CLI project.
  - Prompts for the database password without echo, passes it to psql through a
    process-only environment variable, and clears it afterwards. The password and
    connection string are never printed or written to disk.
  - The SQL runs in one READ ONLY transaction that is rolled back. Output (counts
    and booleans; no student, payment or provider identifiers) is saved next to
    this script as qa-preflight-<timestamp>.txt.

.EXAMPLE
  # Session pooler host and user exactly as shown in the QA dashboard (Connect -> Session pooler):
  powershell -ExecutionPolicy Bypass -File .\Run-QaPreflight.ps1 `
    -DbHost aws-0-<region>.pooler.supabase.com -DbUser postgres.ynwzijulzksmrcwdhudv
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$DbHost,
    [Parameter(Mandatory = $true)][string]$DbUser,
    [int]$Port = 5432,
    [string]$Database = 'postgres'
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$QaRef = 'ynwzijulzksmrcwdhudv'
$ProdRef = 'bwlkxunujngksibfzzfv'

try {
    $target = ($DbHost + ' ' + $DbUser).ToLowerInvariant()
    if ($target.Contains($ProdRef)) { throw 'Refusing: the target names the PRODUCTION project.' }
    if (-not $target.Contains($QaRef)) { throw "Refusing: neither host nor user contains the QA project ref $QaRef." }
    if ($Port -ne 5432) { throw 'Use the session pooler or direct connection on port 5432 (a single session is required for the read-only transaction).' }
    $psql = Get-Command psql -ErrorAction SilentlyContinue
    if ($null -eq $psql) { throw 'psql was not found on PATH. Install the PostgreSQL client tools first.' }
    $sqlFile = Join-Path $PSScriptRoot 'CC18-QA-PREFLIGHT.sql'
    if (-not (Test-Path -LiteralPath $sqlFile)) { throw "Missing $sqlFile" }

    Write-Host "Target: QA project $QaRef via $DbHost (user $DbUser). Read-only preflight; nothing will be written." -ForegroundColor Cyan
    $typed = Read-Host "Type the QA project ref to confirm"
    if ($typed -ne $QaRef) { throw 'Confirmation did not match. Nothing was run.' }
    $secure = Read-Host 'QA database password (not shown)' -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $out = Join-Path $PSScriptRoot ('qa-preflight-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.txt')
    try {
        $env:PGPASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
        $env:PGSSLMODE = 'require'
        $env:PGAPPNAME = 'nextwise-cc18-qa-preflight'
        # psql may write notices to stderr; under 'Stop' Windows PowerShell 5.1 would abort. Judge by exit code.
        $ErrorActionPreference = 'Continue'
        & $psql.Source -X -h $DbHost -p $Port -U $DbUser -d $Database -v ON_ERROR_STOP=1 -f $sqlFile 2>&1 | Tee-Object -FilePath $out
        $code = $LASTEXITCODE
        $ErrorActionPreference = 'Stop'
    } finally {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    if ($code -ne 0) { throw "psql exited with $code. See $out" }
    Write-Host "Preflight finished (rolled back). Output: $out" -ForegroundColor Green
    exit 0
} catch {
    Write-Host "REFUSED/FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
