param(
  [string]$WorldName = 'Jurassic City Park',
  [string]$SourceWorld = 'jurassic-city-v2',
  [string]$Instance = 'D:/codeSource/product/jev/mindcraft-client/.minecraft/versions/1.21.1-NeoForge'
)
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$source = Join-Path (Join-Path $PSScriptRoot 'server') $SourceWorld
if (Get-NetTCPConnection -LocalPort 25576 -State Listen -ErrorAction SilentlyContinue) {
  throw 'Stop the construction server cleanly before exporting.'
}
if (!(Test-Path (Join-Path $source 'level.dat'))) { throw 'No completed world was found.' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$release = Join-Path $project "delivery/Jurassic-City-Park-$stamp"
$save = Join-Path $release $WorldName
New-Item -ItemType Directory -Path $save -Force | Out-Null
Get-ChildItem -LiteralPath $source -Force | Where-Object { $_.Name -ne 'session.lock' } |
  Copy-Item -Destination $save -Recurse -Force
& node (Join-Path $PSScriptRoot 'prepare-world.mjs') $save $WorldName
if ($LASTEXITCODE -ne 0) { throw 'World settings could not be prepared.' }
$saves = Join-Path $Instance 'saves'
New-Item -ItemType Directory -Path $saves -Force | Out-Null
$target = Join-Path $saves $WorldName
if (Test-Path $target) { $target = Join-Path $saves "$WorldName-$stamp" }
Copy-Item -LiteralPath $save -Destination $target -Recurse
Copy-Item -LiteralPath (Join-Path $project 'modpack') -Destination $release -Recurse
Copy-Item -LiteralPath (Join-Path $project 'verification') -Destination $release -Recurse
Copy-Item -LiteralPath (Join-Path $project 'map') -Destination $release -Recurse
Copy-Item -LiteralPath (Join-Path $project 'README.md') -Destination $release
$builderSource = Join-Path $project 'builder/MDK-1.21.1-ModDevGradle-main'
$builderTarget = Join-Path $release 'builder'
New-Item -ItemType Directory -Path $builderTarget -Force | Out-Null
foreach ($name in @('src','gradle','build.gradle','settings.gradle','gradle.properties','gradlew','gradlew.bat','TEMPLATE_LICENSE.txt')) {
  Copy-Item -LiteralPath (Join-Path $builderSource $name) -Destination $builderTarget -Recurse
}
New-Item -ItemType Directory -Path (Join-Path $release 'runtime') -Force | Out-Null
Get-ChildItem -LiteralPath $PSScriptRoot -File | Copy-Item -Destination (Join-Path $release 'runtime')
Copy-Item -LiteralPath (Join-Path $project 'package.json') -Destination $release
$receipt = [ordered]@{
  exportedAt = (Get-Date).ToString('o')
  minecraft = '1.21.1'
  world = $save
  installedSave = $target
  instance = $Instance
  sourceWorld = $source
  levelSha256 = (Get-FileHash (Join-Path $save 'level.dat') -Algorithm SHA256).Hash
}
$receipt | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $release 'export.json') -Encoding utf8
$receipt | ConvertTo-Json
