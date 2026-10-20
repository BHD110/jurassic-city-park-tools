param(
  [string]$MinecraftRoot = 'D:/codeSource/product/jev/mindcraft-client/.minecraft',
  [string]$VersionName = '1.21.1-NeoForge',
  [string]$Java = 'C:/Program Files/Eclipse Adoptium/jdk-21.0.10.7-hotspot/bin/java.exe',
  [string]$QuickPlayServer,
  [string]$QuickPlayWorld,
  [string]$GameDirectoryOverride,
  [string[]]$ExtraJvmArgs = @(),
  [int]$Width = 0,
  [int]$Height = 0,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$instance = Join-Path $MinecraftRoot "versions/$VersionName"
$gameDirectory = if ($GameDirectoryOverride) { $GameDirectoryOverride } else { $instance }
$versionPath = Join-Path $instance "$VersionName.json"
$version = Get-Content -LiteralPath $versionPath -Raw | ConvertFrom-Json
$libraries = Join-Path $MinecraftRoot 'libraries'
$natives = Join-Path $instance 'natives-windows-x86_64'
$separator = [IO.Path]::PathSeparator

function Test-WindowsRule($rules) {
  if (-not $rules) { return $true }
  $allowed = $false
  foreach ($rule in $rules) {
    $os = $rule.os
    if ($os -and $os.name -and $os.name -notin @('windows', 'universal')) { continue }
    if ($os -and $os.arch -and $os.arch -notin @('x86_64', 'x64')) { continue }
    if ($rule.features) { continue }
    $allowed = $rule.action -eq 'allow'
  }
  return $allowed
}

$classpathFiles = @(
  foreach ($library in $version.libraries) {
    if (-not (Test-WindowsRule $library.rules)) { continue }
    if (-not $library.downloads.artifact.path) { continue }
    Join-Path $libraries $library.downloads.artifact.path
  }
  Join-Path $instance "$VersionName.jar"
)
foreach ($path in @($Java, $natives, (Join-Path $MinecraftRoot "assets/indexes/$($version.assets).json")) + $classpathFiles) {
  if (-not (Test-Path -LiteralPath $path)) { throw "Missing client file: $path" }
}

$values = @{
  'auth_player_name' = 'hxy'
  'version_name' = $VersionName
  'game_directory' = $gameDirectory
  'assets_root' = (Join-Path $MinecraftRoot 'assets')
  'assets_index_name' = $version.assets
  'auth_uuid' = '00000000-0000-3000-8000-000000000001'
  'auth_access_token' = '0'
  'clientid' = ''
  'auth_xuid' = ''
  'user_type' = 'legacy'
  'version_type' = 'NeoForge'
  'natives_directory' = $natives
  'launcher_name' = 'JurassicRebornLocal'
  'launcher_version' = '1'
  'classpath' = ($classpathFiles -join $separator)
  'library_directory' = $libraries
  'classpath_separator' = $separator
  'primary_jar_name' = $VersionName
}
function Expand-LaunchValue([string]$value) {
  return [regex]::Replace($value, '\$\{([^}]+)\}', {
    param($match)
    $key = $match.Groups[1].Value
    if (-not $values.ContainsKey($key)) { throw "Unknown launch variable: $key" }
    return [string]$values[$key]
  })
}

$jvmArgs = @('-Xmx6G')
$jvmArgs += $ExtraJvmArgs
foreach ($entry in $version.arguments.jvm) {
  if ($entry -is [string]) { $jvmArgs += Expand-LaunchValue $entry }
  elseif (Test-WindowsRule $entry.rules) {
    foreach ($value in $entry.value) { $jvmArgs += Expand-LaunchValue $value }
  }
}
$gameArgs = @()
foreach ($entry in $version.arguments.game) {
  if ($entry -is [string]) { $gameArgs += Expand-LaunchValue $entry }
}
if ($QuickPlayServer) { $gameArgs += @('--quickPlayMultiplayer', $QuickPlayServer) }
if ($QuickPlayWorld) { $gameArgs += @('--quickPlaySingleplayer', $QuickPlayWorld) }
if ($Width -gt 0) { $gameArgs += @('--width', [string]$Width) }
if ($Height -gt 0) { $gameArgs += @('--height', [string]$Height) }

Write-Host "Client: $instance"
Write-Host "Java: $Java"
Write-Host "Libraries: $($classpathFiles.Count)"
Write-Host "Quick play: $(if ($QuickPlayServer) { $QuickPlayServer } else { 'none' })"
if ($DryRun) { return }

Push-Location $gameDirectory
try {
  & $Java @jvmArgs $version.mainClass @gameArgs
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
