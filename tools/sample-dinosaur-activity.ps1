param([int]$DaySeconds = 45, [int]$NightSeconds = 45)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $root
$control = Join-Path $root 'runtime/server/control.ps1'
$world = Join-Path $root 'runtime/server/jurassic-city-v2'
$batchTag = 'jurassic_population_expansion_20261017'
$baselinePath = Join-Path $root 'verification/population-activity-followup-audit.json'
$dayPath = Join-Path $root 'verification/population-activity-day-audit.json'
$nightPath = Join-Path $root 'verification/population-activity-night-audit.json'
$selectionPath = Join-Path $root 'verification/population-activity-selection.json'
$status = & $control 'parkbuild status'
if ($status -notmatch 'done=true|^idle$') { throw "Builder active: $status" }
$baseline = Get-Content -LiteralPath $baselinePath -Raw | ConvertFrom-Json
if (!$baseline.passed -or $baseline.totalDinosaurs -ne 128) { throw '128-dinosaur baseline missing.' }
$selection = @()
foreach ($group in ($baseline.dinosaurs | Group-Object id)) {
  $original = $group.Group | Where-Object { $_.tags -notcontains $batchTag } | Select-Object -First 1
  $added = $group.Group | Where-Object { $_.tags -contains $batchTag } | Select-Object -First 1
  if (!$original -or !$added) { throw "Missing original or added representative for $($group.Name)" }
  $selection += @($original, $added)
}
if ($selection.Count -ne 16) { throw "Expected 16 representatives, got $($selection.Count)" }
$chunks = @($selection | ForEach-Object {
  $cx = [math]::Floor($_.position[0] / 16)
  $cz = [math]::Floor($_.position[2] / 16)
  [pscustomobject]@{ key = "$cx,$cz"; x = [int]$cx * 16; z = [int]$cz * 16 }
} | Sort-Object key -Unique)
$timeReply = & $control 'time query daytime'
if ($timeReply -notmatch '(\d+)') { throw "Could not read original time: $timeReply" }
$originalTime = [int]$matches[1]
$forced = @()
try {
  foreach ($chunk in $chunks) {
    $response = & $control "forceload add $($chunk.x) $($chunk.z)"
    if (!$?) { throw "Could not force chunk $($chunk.key): $response" }
    $forced += $chunk
  }
  & $control 'time set 1000' | Out-Null
  Start-Sleep -Seconds $DaySeconds
  & $control 'save-all flush' | Out-Null
  & node (Join-Path $root 'verification/check-save.mjs') $world $dayPath 'dinosaur-population-expansion' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Day audit failed.' }
  & $control 'time set 14000' | Out-Null
  Start-Sleep -Seconds $NightSeconds
  & $control 'save-all flush' | Out-Null
  & node (Join-Path $root 'verification/check-save.mjs') $world $nightPath 'dinosaur-population-expansion' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Night audit failed.' }
} finally {
  & $control "time set $originalTime" | Out-Null
  foreach ($chunk in $forced) { & $control "forceload remove $($chunk.x) $($chunk.z)" | Out-Null }
  & $control 'save-all flush' | Out-Null
}
[ordered]@{
  originalTime = $originalTime
  daySeconds = $DaySeconds
  nightSeconds = $NightSeconds
  forcedChunks = $chunks
  representatives = $selection | ForEach-Object { [ordered]@{ id = $_.id; uuid = $_.uuid; original = ($_.tags -notcontains $batchTag); initialPosition = $_.position } }
  baseline = $baselinePath
  day = $dayPath
  night = $nightPath
  temporaryForceloadRemoved = $true
  originalTimeRestored = $true
} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $selectionPath -Encoding utf8
Write-Output $selectionPath
