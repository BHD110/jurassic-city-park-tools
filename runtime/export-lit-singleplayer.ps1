param(
    [string]$Instance = 'D:/codeSource/product/jev/mindcraft-client/.minecraft/versions/1.21.1-NeoForge'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$source = Join-Path $PSScriptRoot 'server/jurassic-city-v2'
if (Get-NetTCPConnection -LocalPort 25576 -State Listen -ErrorAction SilentlyContinue) { throw 'Stop the server before exporting.' }
$backup = (Get-Content -LiteralPath (Join-Path $root 'verification/interior-lighting-backup.json') -Raw | ConvertFrom-Json).backup
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$folder = 'Jurassic City Park - Interior Lights'
$release = Join-Path $root "delivery/Jurassic-City-Park-Interior-Lights-$stamp"
$releasedWorld = Join-Path $release $folder
$target = Join-Path $Instance "saves/$folder"
if (Test-Path -LiteralPath $target) { $target = "$target-$stamp" }
New-Item -ItemType Directory -Path $releasedWorld -Force | Out-Null
Get-ChildItem -LiteralPath $source -Force | Where-Object Name -ne 'session.lock' |
    Copy-Item -Destination $releasedWorld -Recurse -Force
& node (Join-Path $PSScriptRoot 'prepare-world.mjs') $releasedWorld $folder
if ($LASTEXITCODE -ne 0) { throw 'Cannot prepare the single-player world.' }
Copy-Item -LiteralPath (Join-Path $root 'map/generated/iv-traffic.json') -Destination (Join-Path $releasedWorld 'citytraffic-plan.json') -Force
New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
Copy-Item -LiteralPath $releasedWorld -Destination $target -Recurse

# Keep the current client settings recoverable before installing integrated-server support.
$clientBackup = Join-Path $backup 'client-before-singleplayer'
New-Item -ItemType Directory -Path $clientBackup -Force | Out-Null
$clientMod = Join-Path $Instance 'mods/parkbuilder-1.0.0.jar'
if (Test-Path -LiteralPath $clientMod) { Copy-Item -LiteralPath $clientMod -Destination $clientBackup }
$mtsConfig = Join-Path $Instance 'config/mtsconfig.json'
Copy-Item -LiteralPath $mtsConfig -Destination $clientBackup
Copy-Item -LiteralPath (Join-Path $root 'builder/MDK-1.21.1-ModDevGradle-main/build/libs/parkbuilder-1.0.0.jar') -Destination $clientMod -Force
& node (Join-Path $PSScriptRoot 'prepare-singleplayer-config.mjs') $Instance
if ($LASTEXITCODE -ne 0) { throw 'Cannot prepare client vehicle safety settings.' }

$receipt = [ordered]@{
    exportedAt = (Get-Date).ToString('o')
    sourceWorld = $source
    releasedWorld = $releasedWorld
    installedSave = $target
    instance = $Instance
    displayName = $folder
    backup = $backup
    restartClientRequired = $true
    gameplayMod = $clientMod
    copiedWorldFiles = @(Get-ChildItem -LiteralPath $target -Recurse -File).Count
}
$receipt | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $release 'export.json') -Encoding utf8
$receipt | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root 'verification/interior-singleplayer-export.json') -Encoding utf8
$receipt | ConvertTo-Json
