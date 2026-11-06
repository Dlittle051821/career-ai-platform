<#
.SYNOPSIS
  NW09.2 - OpenAI live pilot (QA only, fictional adult student only). Windows PowerShell 5.1.

.DESCRIPTION
  Without -LiveApiTest : PREFLIGHT ONLY. Checks the QA target (by project ref), the AI
                         configuration, the fictional student, recorded consent, profile
                         readiness and both pilot budget locks. No OpenAI request is sent.
  With    -LiveApiTest : the same preflight, then - after you type the confirmation
                         phrase - exactly ONE paid OpenAI request through the real
                         Counsellor Studio service path. The result is saved as a DRAFT.

  The OpenAI key is read from .env.local by the OpenAI SDK only. It is never printed,
  logged or written by this script. The QA Supabase service key is read from the
  clipboard (or a hidden prompt), used only to open the QA counsellor's one-time
  session, and never saved.

  Budget: at most 5 paid calls and USD 2.00 in total, enforced twice - by the database
  pilot caps (NW09.2 migration) and by the local ledger .nw09-pilot\ledger.json.

.PARAMETER LiveApiTest
  Send the single paid request (after preflight and a typed confirmation).

.PARAMETER Student
  E-mail of the seeded fictional QA student (default qa-student@nextwise.test).

.EXAMPLE
  .\scripts\nw09\Run-NW09OpenAiLiveTest.ps1
  .\scripts\nw09\Run-NW09OpenAiLiveTest.ps1 -LiveApiTest
#>
[CmdletBinding()]
param(
  [switch]$LiveApiTest,
  [string]$Student = "qa-student@nextwise.test"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

function Fail([string]$Message) {
  Write-Host ""
  Write-Host "X $Message" -ForegroundColor Red
  Write-Host ""
  exit 1
}

# Run from the repository root.
$repo = (Get-Location).Path
if (-not (Test-Path (Join-Path $repo "package.json")) -or -not (Test-Path (Join-Path $repo "scripts\dev\nw09-openai-pilot.ts"))) {
  Fail "Run this from the Nextwise repository root (where package.json is), after installing the NW09.2 package."
}
if (-not (Test-Path (Join-Path $repo "node_modules\openai\package.json"))) {
  Fail "node_modules\openai is missing. NW09.2 adds no dependencies; your existing node_modules should already contain it. Do not run npm install for this milestone without checking first."
}
if ($env:VERCEL_ENV -or $env:NODE_ENV -eq "production") { Fail "A production / Vercel environment variable is set in this shell. Open a fresh PowerShell window." }

# Target check by PROJECT REF (names are misleading: Production is labelled "Nextwise Staging").
$envFile = Join-Path $repo ".env.local"
if (-not (Test-Path $envFile)) { Fail ".env.local not found." }
$urlLine = Get-Content $envFile | Where-Object { $_ -match '^\s*NEXT_PUBLIC_SUPABASE_URL\s*=' } | Select-Object -Last 1
if (-not $urlLine) { Fail "NEXT_PUBLIC_SUPABASE_URL is not set in .env.local." }
if ($urlLine -match 'bwlkxunujngksibfzzfv') { Fail "REFUSING: .env.local points at the PRODUCTION database (bwlkxunujngksibfzzfv)." }
if ($urlLine -notmatch 'ynwzijulzksmrcwdhudv') { Fail "REFUSING: .env.local does not point at Nextwise-Development-QA (ynwzijulzksmrcwdhudv)." }
Write-Host "OK Target in .env.local: ynwzijulzksmrcwdhudv (Nextwise-Development-QA)." -ForegroundColor Green

$nodeArgs = @("tsx", "--conditions=react-server", "scripts/dev/nw09-openai-pilot.ts", "--qa", "--key-from-clipboard", "--student", $Student)
if ($LiveApiTest) {
  Write-Host ""
  Write-Host "LIVE API TEST: after the preflight passes you will be asked to type RUN 1 PAID CALL." -ForegroundColor Yellow
  Write-Host "Exactly one OpenAI request is sent; nothing is retried. Ctrl+C now to stop." -ForegroundColor Yellow
  Write-Host ""
  $nodeArgs += "--live-api-test"
} else {
  Write-Host "PREFLIGHT ONLY - no OpenAI request will be sent. Add -LiveApiTest for the paid call." -ForegroundColor Cyan
}

& npx @nodeArgs
$code = $LASTEXITCODE
Write-Host ""
switch ($code) {
  0 { if ($LiveApiTest) { Write-Host "Live test finished: SUCCEEDED. Next: .\scripts\nw09\Verify-NW09Workflow.ps1, then check the draft in the Counsellor Studio." -ForegroundColor Green } else { Write-Host "Preflight finished." -ForegroundColor Green } }
  2 { Write-Host "Live test finished: NOT GENERATED. Read the category above; do not retry blindly - each attempt may be billed." -ForegroundColor Yellow }
  default { Write-Host "Stopped (exit code $code). Nothing further was sent." -ForegroundColor Red }
}
exit $code
