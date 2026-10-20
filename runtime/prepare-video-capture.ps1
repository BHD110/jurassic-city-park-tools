param([string]$Target = 'D:/codeSource/product/我的世界-小蒙/video/capture-instance')
$ErrorActionPreference = 'Stop'
$source = 'D:/codeSource/product/jev/mindcraft-client/.minecraft/versions/1.21.1-NeoForge'
$world = 'Jurassic City Park - Interior Lights'
if (Test-Path -LiteralPath $Target) { throw "Capture directory already exists: $Target" }
New-Item -ItemType Directory -Path $Target | Out-Null
foreach ($name in @('mods','config','defaultconfigs','resourcepacks','shaderpacks','easy_npc')) {
  $from = Join-Path $source $name
  if (Test-Path -LiteralPath $from) { Copy-Item -LiteralPath $from -Destination $Target -Recurse }
}
New-Item -ItemType Directory -Path (Join-Path $Target 'saves') | Out-Null
Copy-Item -LiteralPath (Join-Path $source "saves/$world") -Destination (Join-Path $Target 'saves') -Recurse
$options = Get-Content -LiteralPath (Join-Path $source 'options.txt')
$settings = @{ fullscreen='false'; renderDistance='12'; simulationDistance='5'; maxFps='60'; enableVsync='false'; pauseOnLostFocus='false'; guiScale='2'; renderClouds='"false"'; bobView='false' }
$options = foreach ($line in $options) {
  $key = ($line -split ':',2)[0]
  if ($settings.ContainsKey($key)) { "${key}:$($settings[$key])" } else { $line }
}
[IO.File]::WriteAllLines((Join-Path $Target 'options.txt'), $options, [Text.UTF8Encoding]::new($false))
[ordered]@{ createdAt=[DateTimeOffset]::UtcNow.ToString('o'); sourceWorld=(Join-Path $source "saves/$world"); captureDirectory=$Target; originalWorldUntouched=$true } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Target 'capture-origin.json') -Encoding utf8
Write-Output $Target
