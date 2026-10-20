$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$world = Join-Path $PSScriptRoot 'server/jurassic-city-v2'
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    if (!(Get-NetTCPConnection -LocalPort 25576 -State Listen -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Seconds 1
}
if (Get-NetTCPConnection -LocalPort 25576 -State Listen -ErrorAction SilentlyContinue) { throw 'Server is still running.' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $root "backups/before-interior-lighting-$stamp"
New-Item -ItemType Directory -Path $backup | Out-Null
Copy-Item -LiteralPath $world -Destination (Join-Path $backup 'world') -Recurse
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'server/config') -Destination (Join-Path $backup 'server-config') -Recurse
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'server/mods') -Destination (Join-Path $backup 'server-mods') -Recurse
foreach ($name in @('upgrade-full', 'city-coaster-route', 'iv-traffic')) {
    Copy-Item -LiteralPath (Join-Path $root "map/generated/$name.json") -Destination $backup
}
Copy-Item -LiteralPath (Join-Path $root 'builder/MDK-1.21.1-ModDevGradle-main/src/main/java/com/example/examplemod/CityTraffic.java') -Destination $backup
$before = @(Get-ChildItem -LiteralPath $world -Recurse -File)
$after = @(Get-ChildItem -LiteralPath (Join-Path $backup 'world') -Recurse -File)
$beforeBytes = ($before | Measure-Object Length -Sum).Sum
$afterBytes = ($after | Measure-Object Length -Sum).Sum
if ($before.Count -ne $after.Count -or $beforeBytes -ne $afterBytes) { throw 'Backup size mismatch.' }
$receipt = [ordered]@{ backup = $backup; files = $after.Count; bytes = $afterBytes; completedAt = (Get-Date).ToString('o') }
$receipt | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $backup 'backup.json') -Encoding utf8
$receipt | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root 'verification/interior-lighting-backup.json') -Encoding utf8
$receipt | ConvertTo-Json
