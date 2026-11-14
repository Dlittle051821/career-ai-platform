<#
.SYNOPSIS
  NEXTWISE V5.6.2 public launch: stage a PRODUCTION deployment of an exact, gated commit WITHOUT assigning
  www.nextwise.world, validate it, and (separately, by hand) promote or roll back.
  Never changes a database, never changes Vercel environment variables, never pushes or merges.
  There is no sign-off or override option: every gate must pass.

.DESCRIPTION
  -Verify   (default)  Fresh clone of -Branch at -ReleaseSha. Gates G1 (source) and G2 (tests), plus G3
                       (legal approval) and G4 (database inspection) when their inputs are given.
  -Stage               All gates G1-G4 must pass. Records the deployment now behind www.nextwise.world (the
                       ROLLBACK target), runs `vercel deploy --prod --skip-domain`, checks the domain did not
                       move, then G6: validates the staged URL over HTTP. Writes RELEASE-RECORD.txt.
  -Validate <url>      Re-runs the HTTP validation on a deployment (for example after you add the
                       VERCEL_AUTOMATION_BYPASS_SECRET environment variable).
  -Promote <url>       Manual: type PROMOTE. `vercel promote`, then validates https://www.nextwise.world.
  -Rollback <url>      Manual: type ROLLBACK. `vercel rollback` to the recorded previous deployment.

.EXAMPLE
  .\STAGE-V562-PUBLIC-LAUNCH.ps1 -Verify -ReleaseSha <commit>
  .\STAGE-V562-PUBLIC-LAUNCH.ps1 -Stage -ReleaseSha <commit> -Inspection .\prod-inspection.json -Attestation .\prod-attestation.json -Scope <team>
  .\STAGE-V562-PUBLIC-LAUNCH.ps1 -Promote https://nextwise-world-sta-xxxx.vercel.app -Scope <team>
#>
[CmdletBinding(DefaultParameterSetName = 'Verify')]
param(
    [Parameter(ParameterSetName = 'Verify')][switch]$Verify,
    [Parameter(ParameterSetName = 'Stage')][switch]$Stage,
    [Parameter(ParameterSetName = 'Validate')][string]$Validate = '',
    [Parameter(ParameterSetName = 'Promote')][string]$Promote = '',
    [Parameter(ParameterSetName = 'Rollback')][string]$Rollback = '',
    [string]$ReleaseSha = '',
    [string]$Inspection = '',
    [string]$Attestation = '',
    [string]$Workdir = 'C:\ClaudeBuilds\RELEASE-V562-PUBLIC',
    [string]$RepoUrl = 'https://github.com/Dlittle051821/career-ai-platform.git',
    [string]$Branch = 'release/v562-public-launch',
    [string]$Project = 'nextwise-world-sta',
    [string]$Domain = 'www.nextwise.world',
    [string]$Scope = '',
    [string]$CurrentProductionUrl = '',
    [switch]$SkipTests
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$ApprovedBase = '3f8c59d09dcd48eae32b528013372ddf15ca9e71'   # preview/v562-approved
$log = Join-Path $PSScriptRoot ('stage-v562-public-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.txt')
$results = New-Object System.Collections.Generic.List[object]
function Add-Result([string]$Name, [bool]$Ok, [string]$Detail) {
    $results.Add([pscustomobject]@{ Check = $Name; Result = $(if ($Ok) { 'PASS' } else { 'FAIL' }); Detail = $Detail })
    $c = 'Green'; if (-not $Ok) { $c = 'Red' }
    Write-Host ("[{0}] {1} {2}" -f $(if ($Ok) { 'PASS' } else { 'FAIL' }), $Name, $Detail) -ForegroundColor $c
    Add-Content -LiteralPath $log -Value ("[{0}] {1} {2}" -f $(if ($Ok) { 'PASS' } else { 'FAIL' }), $Name, $Detail)
}
function Invoke-Cmd([string]$Exe, [string[]]$CmdArgs) {
    $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { $out = & $Exe @CmdArgs 2>&1; return [pscustomobject]@{ Code = $LASTEXITCODE; Output = ($out | Out-String).Trim() } }
    finally { $ErrorActionPreference = $prev }
}
function Invoke-Step([string]$Name, [string]$Exe, [string[]]$StepArgs) {
    Write-Host "== $Name" -ForegroundColor Cyan
    $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { & $Exe @StepArgs 2>&1 | Tee-Object -FilePath $log -Append | Out-Host; Add-Result $Name ($LASTEXITCODE -eq 0) "exit $LASTEXITCODE" }
    finally { $ErrorActionPreference = $prev }
}
function Get-VercelArgs([string[]]$a) { if ($Scope) { return $a + @('--scope', $Scope) } return $a }
function Get-ServingUrl([string]$Target) {
    $r = Invoke-Cmd 'vercel' (Get-VercelArgs @('inspect', $Target))
    $m = [regex]::Match($r.Output, 'url\s+(https://\S+\.vercel\.app)')
    if ($r.Code -eq 0 -and $m.Success) { return $m.Groups[1].Value }
    if ($CurrentProductionUrl) { return $CurrentProductionUrl }
    throw "Could not read the deployment behind $Target with vercel inspect. Copy the current Production deployment URL from the Vercel dashboard (Deployments, the one marked Current) and re-run with -CurrentProductionUrl <url>."
}
function Confirm-Typed([string]$Word) {
    $answer = Read-Host "Type $Word to continue (anything else cancels)"
    if ($answer -cne $Word) { throw 'Cancelled. Nothing was changed.' }
}
# G6: HTTP validation of a deployment (scripts/release/v562-validate-deployment.mjs). Never prints the bypass secret.
function Test-Deployment([string]$Url, [string]$RepoDir) {
    $validator = [IO.Path]::Combine($RepoDir, 'scripts', 'release', 'v562-validate-deployment.mjs')
    if (-not (Test-Path -LiteralPath $validator)) { $validator = Join-Path $PSScriptRoot 'v562-validate-deployment.mjs' }
    $r = Invoke-Cmd 'node' @($validator, $Url)
    Add-Content -LiteralPath $log -Value $r.Output
    $r.Output -split "`n" | Where-Object { $_ -match '^(FAIL|\d+/\d+ PASS)' -or $_ -match 'Deployment Protection' -or $_ -match 'not a Nextwise deployment' } | ForEach-Object { Write-Host $_ }
    if ($r.Code -eq 3) {
        Add-Result "G6 HTTP validation of $Url" $false 'Deployment Protection is on. Set $env:VERCEL_AUTOMATION_BYPASS_SECRET (Vercel > Settings > Deployment Protection > Protection Bypass for Automation) and run -Validate, or check it in a browser signed in to Vercel.'
        return $false
    }
    Add-Result "G6 HTTP validation of $Url" ($r.Code -eq 0) ((($r.Output -split "`n") | Select-Object -Last 1).Trim())
    return ($r.Code -eq 0)
}

try {
    foreach ($p in @($Workdir)) { if ($p.TrimEnd('\') -ieq 'C:\carrier.ai') { throw 'Refusing to use C:\carrier.ai.' } }
    if ($null -eq (Get-Command git -ErrorAction SilentlyContinue)) { throw 'git was not found on PATH.' }
    if ($null -eq (Get-Command node -ErrorAction SilentlyContinue)) { throw 'node was not found on PATH.' }

    # ---------------- validate / promote / rollback ----------------
    if ($Validate) { $null = Test-Deployment $Validate $Workdir; throw 'DONE' }
    if ($Promote -or $Rollback) {
        if ($null -eq (Get-Command vercel -ErrorAction SilentlyContinue)) { throw 'Vercel CLI not found. Install it with: npm i -g vercel, then run: vercel login' }
        $url = $(if ($Promote) { $Promote } else { $Rollback })
        if ($url -notmatch '^https://[a-z0-9-]+\.vercel\.app/?$') { throw "Expected a https://….vercel.app deployment URL, got: $url" }
        $before = Get-ServingUrl $Domain
        Write-Host "$Domain currently serves: $before" -ForegroundColor Yellow
        Write-Host ("About to make {0} serve: {1}" -f $Domain, $url) -ForegroundColor Yellow
        Confirm-Typed $(if ($Promote) { 'PROMOTE' } else { 'ROLLBACK' })
        $r = $(if ($Promote) { Invoke-Cmd 'vercel' (Get-VercelArgs @('promote', $url, '--timeout', '5m')) } else { Invoke-Cmd 'vercel' (Get-VercelArgs @('rollback', $url)) })
        Add-Content -LiteralPath $log -Value $r.Output
        Add-Result $(if ($Promote) { 'vercel promote' } else { 'vercel rollback' }) ($r.Code -eq 0) "exit $($r.Code)"
        if ($r.Code -eq 0) {
            Start-Sleep -Seconds 10
            $after = Get-ServingUrl $Domain
            Add-Result "$Domain now serves the chosen deployment" ($after.TrimEnd('/') -eq $url.TrimEnd('/')) $after
            if ($Promote) { $null = Test-Deployment ("https://" + $Domain) $Workdir }
            Add-Content -LiteralPath (Join-Path $PSScriptRoot 'RELEASE-RECORD.txt') -Value ("{0}  {1}: {2} -> {3}" -f (Get-Date -Format s), $(if ($Promote) { 'PROMOTED' } else { 'ROLLED BACK' }), $before, $after)
        }
        throw 'DONE'
    }

    # ---------------- G1 source ----------------
    if ($ReleaseSha -notmatch '^[0-9a-f]{40}$') { throw '-ReleaseSha must be the full 40-character commit to release (see the kit README).' }
    if (Test-Path -LiteralPath $Workdir) { throw "$Workdir already exists. Remove it (or pass a new -Workdir) so the release is built from a fresh clone." }
    Invoke-Step "Fresh clone of $Branch" 'git' @('clone', '--branch', $Branch, $RepoUrl, $Workdir)
    $null = Invoke-Cmd 'git' @('-C', $Workdir, 'checkout', '--quiet', $ReleaseSha)
    $head = (Invoke-Cmd 'git' @('-C', $Workdir, 'rev-parse', 'HEAD')).Output
    Add-Result 'G1 HEAD is exactly the release commit' ($head -eq $ReleaseSha) $head
    $anc = Invoke-Cmd 'git' @('-C', $Workdir, 'merge-base', '--is-ancestor', $ApprovedBase, $ReleaseSha)
    Add-Result 'G1 release commit is built on the approved tip 3f8c59d' ($anc.Code -eq 0) ''
    $tip = Invoke-Cmd 'git' @('ls-remote', $RepoUrl, 'refs/heads/preview/v562-approved')
    Add-Result 'G1 approved branch has not moved past 3f8c59d' ($tip.Output -match "^$ApprovedBase") (($tip.Output -split '\s')[0])
    $onBranch = Invoke-Cmd 'git' @('-C', $Workdir, 'merge-base', '--is-ancestor', $ReleaseSha, "origin/$Branch")
    Add-Result "G1 release commit is on origin/$Branch" ($onBranch.Code -eq 0) ''
    $dirty = (Invoke-Cmd 'git' @('-C', $Workdir, 'status', '--porcelain')).Output
    Add-Result 'G1 clean checkout' ([string]::IsNullOrWhiteSpace($dirty)) ''

    # ---------------- G2 tests ----------------
    if (-not $SkipTests) {
        Set-Location -LiteralPath $Workdir
        foreach ($v in @('NEXTWISE_PAID_CHECKOUT', 'NEXTWISE_PAID_CHECKOUT_PREREQUISITES', 'OPENAI_API_KEY', 'AI_OPENAI_APPROVED', 'NEXTWISE_LAUNCH_MODE', 'VERCEL_ENV')) { Remove-Item -LiteralPath "Env:$v" -ErrorAction SilentlyContinue }
        Invoke-Step 'G2 npm ci' 'npm.cmd' @('ci')
        Invoke-Step 'G2 TypeScript' 'npm.cmd' @('run', 'typecheck', '--', '--incremental', 'false')
        Invoke-Step 'G2 ESLint' 'npm.cmd' @('run', 'lint')
        Invoke-Step 'G2 approved-baseline guard (Home, header, contacts, V5.4, V5.6.2)' 'npx.cmd' @('vitest', 'run', 'src/config/approved-baseline.test.ts')
        Invoke-Step 'G2 public-launch guards (launch mode, legal)' 'npx.cmd' @('vitest', 'run', 'src/lib/launch', 'src/config/legal.test.ts')
        Invoke-Step 'G2 full Vitest suite' 'npm.cmd' @('test')
        Invoke-Step 'G2 npm audit' 'npm.cmd' @('audit', '--audit-level=low')
    }

    # ---------------- G3 legal ----------------
    $legal = Get-Content -LiteralPath ([IO.Path]::Combine($Workdir, 'src', 'config', 'legal.ts')) -Raw
    $approved = ($legal -match 'status:\s*"approved"') -and ($legal -match 'approvedBy:\s*"[^"]+"') -and ($legal -match 'approvedOn:\s*"[^"]+"') -and ($legal -match 'effectiveDate:\s*"[^"]+"')
    Add-Result 'G3 legal texts approved (status, approver, date, effective date)' $approved $(if ($approved) { '' } else { 'still draft-for-legal-review: see docs/release/V562-LEGAL-REVIEW.md' })

    # ---------------- G4 database ----------------
    if ($Inspection -and $Attestation) {
        $ev = Invoke-Cmd 'node' @(([IO.Path]::Combine($Workdir, 'scripts', 'release', 'v562-evaluate-inspection.mjs')), $Inspection, $Attestation)
        Add-Content -LiteralPath $log -Value $ev.Output
        $ev.Output -split "`n" | Where-Object { $_ -match '^(PASS|FAIL|NEEDS)' } | ForEach-Object { Write-Host $_ }
        Add-Result 'G4 production database gate (read-only inspection + attestation)' ($ev.Code -eq 0) ((($ev.Output -split "`n") | Select-Object -Last 1).Trim())
    } else {
        Add-Result 'G4 production database gate' $false 'pass -Inspection prod-inspection.json -Attestation prod-attestation.json'
    }

    $failed = @($results | Where-Object { $_.Result -eq 'FAIL' }).Count
    if (-not $Stage) { throw 'VERIFY-DONE' }
    if ($failed -gt 0) { throw "Not staging: $failed gate(s) failed. There is no override." }

    # ---------------- stage: production build, domain NOT assigned ----------------
    if ($null -eq (Get-Command vercel -ErrorAction SilentlyContinue)) { throw 'Vercel CLI not found. Install it with: npm i -g vercel, then run: vercel login' }
    Set-Location -LiteralPath $Workdir
    Invoke-Step "Link to Vercel project $Project" 'vercel' (Get-VercelArgs @('link', '--yes', '--project', $Project))
    $envs = Invoke-Cmd 'vercel' (Get-VercelArgs @('env', 'ls', 'production'))
    Add-Result 'G5 Production env: NEXTWISE_LAUNCH_MODE (names only; the value is checked on the staged build)' $true $(if ($envs.Output -match 'NEXTWISE_LAUNCH_MODE') { 'present: must be public-marketing (verified by G6 header)' } else { 'absent: Production defaults to public-marketing' })
    $rollbackUrl = Get-ServingUrl $Domain
    Add-Result "Recorded current production (rollback target) behind $Domain" $true $rollbackUrl
    Write-Host '== vercel deploy --prod --skip-domain (remote build with the project''s Production environment)' -ForegroundColor Cyan
    $d = Invoke-Cmd 'vercel' (Get-VercelArgs @('deploy', '--prod', '--skip-domain', '--yes'))
    Add-Content -LiteralPath $log -Value $d.Output
    $m = [regex]::Matches($d.Output, 'https://[a-z0-9-]+\.vercel\.app')
    $staged = $(if ($m.Count -gt 0) { $m[$m.Count - 1].Value } else { '' })
    Add-Result 'Staged production deployment created (domain not assigned)' ($d.Code -eq 0 -and $staged) $staged
    if ($d.Code -ne 0 -or -not $staged) { throw 'vercel deploy failed; see the log. Production is unchanged.' }
    $now = Get-ServingUrl $Domain
    Add-Result "$Domain still serves the rollback target (not the staged build)" ($now -eq $rollbackUrl) $now
    $insp = Invoke-Cmd 'vercel' (Get-VercelArgs @('inspect', $staged))
    Add-Content -LiteralPath $log -Value $insp.Output
    Add-Result 'Staged deployment target is production' ($insp.Output -match 'target\s+production') ''
    $valid = Test-Deployment $staged $Workdir
    $record = @(
        "V5.6.2 public launch: staged production deployment — $(Get-Date -Format s)",
        "Commit:            $ReleaseSha ($Branch, built on $ApprovedBase)",
        "Staged URL:        $staged",
        "Staged validation: $(if ($valid) { 'PASS' } else { 'NOT PASSED: see the log; do not promote' })",
        "Live ($Domain):    $now",
        "Rollback target:   $rollbackUrl",
        '',
        'Next: open the staged URL on a desktop and a phone (docs/release/V562-PUBLIC-LAUNCH.md section 5), then, to go live:',
        "  vercel promote $staged $(if ($Scope) { "--scope $Scope " })--timeout 5m",
        "  (or .\STAGE-V562-PUBLIC-LAUNCH.ps1 -Promote $staged)",
        'Rollback at any time:',
        "  vercel rollback $rollbackUrl $(if ($Scope) { "--scope $Scope" })",
        "  (or .\STAGE-V562-PUBLIC-LAUNCH.ps1 -Rollback $rollbackUrl, or Vercel dashboard > Deployments > Instant Rollback)"
    )
    $record | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'RELEASE-RECORD.txt') -Encoding UTF8
    $record | ForEach-Object { Write-Host $_ -ForegroundColor Green }
} catch {
    if ($_.Exception.Message -notin @('DONE', 'VERIFY-DONE')) { Add-Result 'Script' $false $_.Exception.Message }
}
Write-Host ''
$results | Format-Table -AutoSize | Out-String -Width 220 | Out-Host
$failedTotal = @($results | Where-Object { $_.Result -eq 'FAIL' }).Count
Write-Host "Log: $log"
if ($failedTotal -gt 0) { Write-Host "$failedTotal check(s) FAILED. Production is unchanged unless a step above says otherwise." -ForegroundColor Red; exit 1 }
Write-Host 'Done. Nothing was promoted automatically.' -ForegroundColor Green
exit 0
