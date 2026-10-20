param(
  [Parameter(Mandatory=$true)][string]$SourceWorld,
  [string]$PlanName = 'upgrade-full'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $root
if ($SourceWorld -notmatch '^[a-zA-Z0-9_-]{1,64}$' -or $SourceWorld -eq 'jurassic-city-v2') {
  throw 'Use the named, verified snapshot rather than the live construction world.'
}
if ($PlanName -notmatch '^[a-zA-Z0-9_-]{1,64}$') { throw 'Invalid plan name.' }
$source = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "server/$SourceWorld")).Path
$planPath = Join-Path $root "map/generated/$PlanName.json"
$routePath = Join-Path $root "verification/$PlanName-route-check.json"
$worldPath = Join-Path $root "verification/$PlanName-world-rail-check.json"
$ridePath = Join-Path $PSScriptRoot "server/parkbuild-railtest-$PlanName.json"
foreach ($file in @($planPath, $routePath, $worldPath, $ridePath)) {
  if (!(Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing final evidence: $file" }
}
$route = Get-Content -LiteralPath $routePath -Raw | ConvertFrom-Json
$world = Get-Content -LiteralPath $worldPath -Raw | ConvertFrom-Json
$ride = Get-Content -LiteralPath $ridePath -Raw | ConvertFrom-Json
$plan = Get-Content -LiteralPath $planPath -Raw | ConvertFrom-Json
$expectedDinosaurs = [int]$plan.metadata.expectedDinosaurCount
if ($expectedDinosaurs -ne 128) { throw 'Final plan must contain 128 dinosaurs.' }
$planSha256 = (Get-FileHash -LiteralPath $planPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($route.status -ne 'passed' -or $route.planFileName -ne $PlanName -or $route.planSha256 -ne $planSha256) {
  throw 'Final route plan check is stale or failed.'
}
foreach ($name in @('provenance', 'realMinecartLapAtLeast300Seconds', 'samplesNearRoute', 'eightZonesObserved', 'noRouteProgressJump')) {
  if ($route.runtimeChecks.$name -ne 'pass') { throw "Final route runtime check not passed: $name" }
}
if ($world.status -ne 'passed' -or $world.planFileName -ne $PlanName -or $world.planSha256 -ne $planSha256 -or
    [IO.Path]::GetFullPath($world.snapshot) -ine $source) { throw 'Final snapshot rail check is stale or failed.' }
if ($world.routeSha256 -ne $route.routeSha256 -or
    $world.levelDatSha256 -ne (Get-FileHash -LiteralPath (Join-Path $source 'level.dat') -Algorithm SHA256).Hash.ToLowerInvariant()) {
  throw 'Final snapshot rail report does not match the source snapshot.'
}
if ($ride.source -ne 'server-minecart' -or $ride.result -ne 'completed' -or $ride.completedLaps -lt 1 -or
    $ride.elapsedSeconds -lt 300 -or $ride.planSha256 -ne $planSha256 -or $ride.routeSha256 -ne $route.routeSha256) {
  throw 'Final rail ride report is stale or incomplete.'
}

$sourceAuditPath = Join-Path $root 'verification/final-source-save-audit.json'
& node (Join-Path $root 'verification/check-save.mjs') $source $sourceAuditPath $PlanName | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Final snapshot failed the dinosaur audit.' }
$sourceAudit = Get-Content -LiteralPath $sourceAuditPath -Raw | ConvertFrom-Json
if (!$sourceAudit.passed -or $sourceAudit.totalDinosaurs -ne $expectedDinosaurs) { throw 'Final snapshot dinosaur count or health is wrong.' }

$exportOutput = @(& (Join-Path $PSScriptRoot 'export-world.ps1') -SourceWorld $SourceWorld)
$receipt = $exportOutput[-1] | ConvertFrom-Json
$release = Split-Path $receipt.world -Parent
$installed = $receipt.installedSave
if ([IO.Path]::GetFullPath($receipt.sourceWorld) -ine $source) { throw 'Export source changed unexpectedly.' }
$installedAuditPath = Join-Path $root 'verification/final-installed-save-audit.json'
& node (Join-Path $root 'verification/check-save.mjs') $installed $installedAuditPath $PlanName | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Installed save failed the dinosaur audit.' }
$installedAudit = Get-Content -LiteralPath $installedAuditPath -Raw | ConvertFrom-Json
if (!$installedAudit.passed -or $installedAudit.totalDinosaurs -ne $expectedDinosaurs -or $installedAudit.gameType -ne 1 -or
    $installedAudit.allowCommands -ne 1 -or $installedAudit.levelName -ne 'Jurassic City Park' -or
    ($installedAudit.spawn -join ',') -ne '0,65,657') { throw 'Installed save settings or dinosaurs are wrong.' }
$installedDinosaurPath = Join-Path $root 'verification/final-installed-dinosaur-check.json'
& node (Join-Path $root 'verification/check-coaster-dinosaurs.mjs') $installed $installedDinosaurPath $PlanName | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Installed save dinosaur zones failed.' }
$installedRailPath = Join-Path $root "verification/$PlanName-installed-world-rail-check.json"
& node (Join-Path $root 'verification/check-coaster-world.mjs') $PlanName $installed $installedRailPath | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Installed save rail blocks failed.' }

function Get-WorldFiles([string]$directory) {
  $base = (Resolve-Path -LiteralPath $directory).Path
  foreach ($file in Get-ChildItem -LiteralPath $base -Recurse -File) {
    [pscustomobject]@{
      path = [IO.Path]::GetRelativePath($base, $file.FullName).Replace('\', '/')
      bytes = [long]$file.Length
      sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
  }
}
$sourceFiles = @(Get-WorldFiles $source | Sort-Object path)
$releaseFiles = @(Get-WorldFiles $receipt.world | Sort-Object path)
$installedFiles = @(Get-WorldFiles $installed | Sort-Object path)
if ($sourceFiles.Count -ne $releaseFiles.Count -or $releaseFiles.Count -ne $installedFiles.Count) {
  throw 'Snapshot, release, and installed save file counts differ.'
}
$sourceByPath = @{}; foreach ($file in $sourceFiles) { $sourceByPath[$file.path] = $file }
$installedByPath = @{}; foreach ($file in $installedFiles) { $installedByPath[$file.path] = $file }
foreach ($file in $releaseFiles) {
  $before = $sourceByPath[$file.path]
  $after = $installedByPath[$file.path]
  if (!$before -or !$after -or $file.sha256 -ne $after.sha256 -or $file.bytes -ne $after.bytes) {
    throw "Release and installed save differ at $($file.path)."
  }
  if ($file.path -ne 'level.dat' -and $file.path -notlike 'playerdata/*.dat' -and
      ($file.sha256 -ne $before.sha256 -or $file.bytes -ne $before.bytes)) {
    throw "Snapshot and release differ unexpectedly at $($file.path)."
  }
}
$manifestPath = Join-Path $release 'world-files.sha256.json'
$fileManifest = [ordered]@{
  hashAlgorithm = 'SHA-256'
  sourceSnapshot = $source
  releaseWorld = $receipt.world
  installedSave = $installed
  files = $releaseFiles
}
$fileManifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding utf8
$manifestSha256 = (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
foreach ($file in @($installedAuditPath, $installedDinosaurPath, $installedRailPath)) {
  Copy-Item -LiteralPath $file -Destination (Join-Path $release 'verification') -Force
}
$receiptPath = Join-Path $release 'export.json'
$complete = [ordered]@{
  exportedAt = $receipt.exportedAt
  minecraft = $receipt.minecraft
  world = $receipt.world
  installedSave = $installed
  instance = $receipt.instance
  sourceWorld = $source
  sourcePlan = $PlanName
  sourcePlanSha256 = $planSha256
  routeSha256 = $route.routeSha256
  railTestSeconds = $ride.elapsedSeconds
  railTestCompletedLaps = $ride.completedLaps
  sourceLevelSha256 = ($sourceByPath['level.dat']).sha256
  levelSha256 = ($releaseFiles | Where-Object path -eq 'level.dat').sha256
  worldFileCount = $releaseFiles.Count
  worldBytes = ($releaseFiles | Measure-Object -Property bytes -Sum).Sum
  installedFileCount = $installedFiles.Count
  installedBytes = ($installedFiles | Measure-Object -Property bytes -Sum).Sum
  sourceWorldFilesExceptPlayerMetadataMatch = $true
  installedWorldFilesMatch = $true
  dinosaurCount = $installedAudit.totalDinosaurs
  creative = ($installedAudit.gameType -eq 1)
  allowCommands = ($installedAudit.allowCommands -eq 1)
  spawn = $installedAudit.spawn
  dinosaurMetabolism = $installedAudit.rules.dinosaurMetabolism
  doDinoBreeding = $installedAudit.rules.doDinoBreeding
  worldFileManifest = $manifestPath
  worldFileManifestSha256 = $manifestSha256
}
$complete | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $receiptPath -Encoding utf8
$indexDir = Join-Path $root 'exports'
New-Item -ItemType Directory -Path $indexDir -Force | Out-Null
$indexPath = Join-Path $indexDir "$(Split-Path $release -Leaf).json"
[ordered]@{
  release = $release
  installedSave = $installed
  exportReceipt = $receiptPath
  exportReceiptSha256 = (Get-FileHash -LiteralPath $receiptPath -Algorithm SHA256).Hash.ToLowerInvariant()
  sourcePlanSha256 = $planSha256
  worldFileManifestSha256 = $manifestSha256
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $indexPath -Encoding utf8
$complete | ConvertTo-Json -Depth 6
