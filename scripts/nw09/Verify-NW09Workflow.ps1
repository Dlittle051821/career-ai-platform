<#
.SYNOPSIS
  NW09.2 - READ-ONLY verification of the AI draft workflow in QA. Windows PowerShell 5.1.

.DESCRIPTION
  Signs in (one-time sessions, no password changed) as the QA counsellor and as the
  fictional QA student and checks: the latest OpenAI run (status, response id, tokens,
  estimated cost, attempts, consent, linked draft), the draft's NW07 status, the pilot
  totals against 5 runs / USD 2.00, and that the student sees no AI data and sees the
  report only after approval AND release. Writes nothing.

.EXAMPLE
  .\scripts\nw09\Verify-NW09Workflow.ps1
#>
[CmdletBinding()]
param([string]$Student = "qa-student@nextwise.test")

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$repo = (Get-Location).Path
if (-not (Test-Path (Join-Path $repo "scripts\dev\nw09-verify-workflow.ts"))) {
  Write-Host "X Run this from the Nextwise repository root after installing the NW09.2 package." -ForegroundColor Red
  exit 1
}
if ($env:VERCEL_ENV -or $env:NODE_ENV -eq "production") { Write-Host "X A production / Vercel environment variable is set in this shell." -ForegroundColor Red; exit 1 }
$urlLine = Get-Content (Join-Path $repo ".env.local") -ErrorAction SilentlyContinue | Where-Object { $_ -match '^\s*NEXT_PUBLIC_SUPABASE_URL\s*=' } | Select-Object -Last 1
if (-not $urlLine -or $urlLine -notmatch 'ynwzijulzksmrcwdhudv' -or $urlLine -match 'bwlkxunujngksibfzzfv') {
  Write-Host "X REFUSING: .env.local must point at Nextwise-Development-QA (ynwzijulzksmrcwdhudv)." -ForegroundColor Red
  exit 1
}

& npx tsx --conditions=react-server scripts/dev/nw09-verify-workflow.ts --qa --key-from-clipboard "--student=$Student"
exit $LASTEXITCODE
