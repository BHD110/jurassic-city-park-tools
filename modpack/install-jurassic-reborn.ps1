param(
  [string]$MinecraftRoot = 'D:/codeSource/product/jev/mindcraft-client/.minecraft',
  [string]$ProjectRoot = $PSScriptRoot
)
$ErrorActionPreference = 'Stop'
$instance = Join-Path $MinecraftRoot 'versions/1.21.1-NeoForge'
$targetMods = Join-Path $instance 'mods'
$targetConfig = Join-Path $instance 'config'
New-Item -ItemType Directory -Force $targetMods, $targetConfig | Out-Null
$entries = (Get-Content (Join-Path $ProjectRoot 'manifest.json') | ConvertFrom-Json).mods
$oldVehicle = Join-Path $targetMods 'automobility-0.5.0.h+1.21.1-neoforge.jar'
if (Test-Path -LiteralPath $oldVehicle) {
  Move-Item -LiteralPath $oldVehicle -Destination (Join-Path $targetMods 'automobility-0.5.0.h+1.21.1-neoforge.jar.disabled') -Force
}
foreach ($entry in $entries) {
  $path = Join-Path $ProjectRoot $entry.file
  $actual = (Get-FileHash $path -Algorithm SHA512).Hash.ToLowerInvariant()
  if ($actual -ne $entry.sha512) { throw "SHA-512 mismatch: $($entry.file)" }
}
foreach ($entry in $entries) {
  Copy-Item -LiteralPath (Join-Path $ProjectRoot $entry.file) -Destination $targetMods -Force
}
Copy-Item (Join-Path $ProjectRoot 'config/jurassicreborn-common.toml') $targetConfig -Force
Copy-Item (Join-Path $ProjectRoot 'config/mtsconfig.json') $targetConfig -Force
Copy-Item (Join-Path $ProjectRoot 'instance/options.txt') $instance -Force
Write-Host "Installed Jurassic Reborn 1.4.2 to $instance"
