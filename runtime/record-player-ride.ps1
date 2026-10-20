param(
  [string]$Player = 'MindcraftViewer',
  [string]$Output = 'verification/player-ride.json',
  [int]$MaxSeconds = 600
)
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$control = Join-Path $PSScriptRoot 'server/control.ps1'
$planFile = Join-Path $project 'map/generated/full.json'
$routeFile = Join-Path $project 'map/generated/route.json'
$plan = Get-Content -LiteralPath $planFile -Raw | ConvertFrom-Json
$route = $plan.route.points
$worldLine = Select-String -LiteralPath (Join-Path $PSScriptRoot 'server/server.properties') -Pattern '^level-name='
$worldName = ($worldLine.Line -split '=', 2)[1]
$samples = [System.Collections.Generic.List[object]]::new()
$started = $null
$progress = 0
$previousIndex = -1
$stationary = 0
$maxStationary = 0
$complete = $false
$failure = ''
$wait = [Diagnostics.Stopwatch]::StartNew()
while ($wait.Elapsed.TotalSeconds -lt ($MaxSeconds + 60)) {
  $reply = (& $control "execute as $Player on vehicle run data get entity @s Pos" | Out-String)
  if ($reply -match '\[(-?[0-9.]+)d,\s*(-?[0-9.]+)d,\s*(-?[0-9.]+)d\]') {
    $position = @([double]::Parse($Matches[1], [cultureinfo]::InvariantCulture), [double]::Parse($Matches[2], [cultureinfo]::InvariantCulture), [double]::Parse($Matches[3], [cultureinfo]::InvariantCulture))
    $now = [DateTimeOffset]::UtcNow
    if ($null -eq $started) { $started = $now }
    $elapsed = ($now - $started).TotalSeconds
    $nearest = -1
    $distance = [double]::PositiveInfinity
    for ($i = 0; $i -lt $route.Count; $i++) {
      $p = $route[$i]
      $d = [Math]::Pow($position[0] - ($p.x + 0.5), 2) + [Math]::Pow($position[1] - $p.y, 2) + [Math]::Pow($position[2] - ($p.z + 0.5), 2)
      if ($d -lt $distance) { $distance = $d; $nearest = $i }
    }
    if ($distance -gt 16) { $failure = 'Vehicle left the planned track'; break }
    if ($previousIndex -ge 0) {
      $advance = ($nearest - $previousIndex + $route.Count) % $route.Count
      if ($advance -gt 120) { $failure = 'Unexpected route jump or reverse movement'; break }
      $progress += $advance
      if ($advance -eq 0) { $stationary += 4 } else { $stationary = 0 }
      $maxStationary = [Math]::Max($maxStationary, $stationary)
      if ($stationary -ge 12) { $failure = 'Vehicle stopped during the tour'; break }
    }
    $tickReply = (& $control 'time query gametime' | Out-String)
    $gameTick = if ($tickReply -match 'time is (\d+)') { [long]$Matches[1] } else { $null }
    $samples.Add([ordered]@{ at = $now.ToString('o'); elapsedSeconds = $elapsed; position = $position; routeIndex = $nearest; progress = $progress; gameTick = $gameTick })
    $previousIndex = $nearest
    if ($progress -ge $route.Count -and $nearest -lt 80) { $complete = $true; break }
    if ($elapsed -gt $MaxSeconds) { $failure = 'Tour exceeded the time limit'; break }
  } elseif ($null -ne $started) {
    $failure = 'Player is no longer riding a vehicle'
    break
  } elseif ($wait.Elapsed.TotalSeconds -ge 60) {
    $failure = 'No player vehicle observed within 60 seconds'
    break
  }
  Start-Sleep -Seconds 4
}
$elapsedSeconds = if ($samples.Count) { $samples[$samples.Count - 1].elapsedSeconds } else { 0 }
$ticks = if ($samples.Count -gt 1) { $samples[$samples.Count - 1].gameTick - $samples[0].gameTick } else { 0 }
$report = [ordered]@{
  inspectedAt = [DateTimeOffset]::UtcNow.ToString('o')
  worldName = $worldName
  fullSha256 = (Get-FileHash -LiteralPath $planFile -Algorithm SHA256).Hash.ToLowerInvariant()
  routeSha256 = (Get-FileHash -LiteralPath $routeFile -Algorithm SHA256).Hash.ToLowerInvariant()
  player = $Player
  evidence = 'Actual player vehicle positions obtained using execute on vehicle'
  completed = $complete
  elapsedSeconds = $elapsedSeconds
  gameTicks = $ticks
  routeProgress = $progress
  maxStationarySeconds = $maxStationary
  failure = $failure
  passed = ($complete -and $elapsedSeconds -ge 300 -and $ticks -ge 6000 -and !$failure)
  samples = $samples.ToArray()
}
$target = Join-Path $project $Output
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $target -Encoding utf8
[pscustomobject]$report | Select-Object worldName, completed, elapsedSeconds, gameTicks, routeProgress, failure, passed | ConvertTo-Json
if (!$report.passed) { exit 1 }
