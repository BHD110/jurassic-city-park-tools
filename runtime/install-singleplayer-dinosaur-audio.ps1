$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$client = 'D:/codeSource/product/jev/mindcraft-client/.minecraft/versions/1.21.1-NeoForge'
$running = @(Get-CimInstance Win32_Process -Filter "name='java.exe' OR name='javaw.exe'" |
    Where-Object { $_.CommandLine -match '--launchTarget forgeclient' -and $_.CommandLine -like "*$client*".Replace('/', '\') })
if ($running.Count) { throw 'Please fully exit the Minecraft client before installing.' }
$sourceJar = Join-Path $root 'builder/MDK-1.21.1-ModDevGradle-main/build/libs/parkbuilder-1.0.0.jar'
$clientJar = Join-Path $client 'mods/parkbuilder-1.0.0.jar'
$serverJar = Join-Path $PSScriptRoot 'server/mods/parkbuilder-1.0.0.jar'
$optionsFile = Join-Path $client 'options.txt'
$packName = 'Jurassic Dinosaur Audio 50'
$packId = "file/$packName"
$sourcePack = Join-Path $PSScriptRoot "dinosaur-audio-stage/$packName"
$targetPack = Join-Path $client "resourcepacks/$packName"
$jarHash = (Get-FileHash -LiteralPath $sourceJar -Algorithm SHA256).Hash
$serverHash = (Get-FileHash -LiteralPath $serverJar -Algorithm SHA256).Hash
$options = [IO.File]::ReadAllText($optionsFile)
$match = [regex]::Match($options, '(?m)^resourcePacks:(.+)\r?$')
if (!$match.Success) { throw 'Missing resourcePacks option' }
$packs = @($match.Groups[1].Value | ConvertFrom-Json)
$packs = @($packs | Where-Object { $_ -ne $packId }) + @($packId)
$newValue = ConvertTo-Json -InputObject $packs -Compress
$newOptions = $options.Substring(0, $match.Index) + "resourcePacks:$newValue" +
    $options.Substring($match.Index + $match.Length)
$sourceSounds = Get-Content -Raw -LiteralPath (Join-Path $sourcePack 'assets/jurassicreborn/sounds.json') |
    ConvertFrom-Json -AsHashtable
$config = Get-Content -Raw -LiteralPath (Join-Path $root 'builder/MDK-1.21.1-ModDevGradle-main/src/main/resources/dinosaur-audio.json') |
    ConvertFrom-Json
if ($sourceSounds.Count -ne $config.events.Count -or $config.radius -ne 50) { throw 'Sound definitions do not match' }
foreach ($event in $sourceSounds.Values) {
    if (!$event.replace -or @($event.sounds | Where-Object { $_.attenuation_distance -ne 50 }).Count) {
        throw 'Invalid sound attenuation'
    }
}
$backup = Join-Path $root ('backups/before-singleplayer-dinosaur-audio-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backup | Out-Null
Copy-Item -LiteralPath $clientJar -Destination (Join-Path $backup 'parkbuilder-1.0.0.jar')
Copy-Item -LiteralPath $optionsFile -Destination (Join-Path $backup 'options.txt')
if (Test-Path -LiteralPath $targetPack) {
    Copy-Item -LiteralPath $targetPack -Destination $backup -Recurse
}
Copy-Item -LiteralPath $sourceJar -Destination $clientJar -Force
Copy-Item -LiteralPath $sourcePack -Destination (Join-Path $client 'resourcepacks') -Recurse -Force
[IO.File]::WriteAllText($optionsFile, $newOptions, [Text.UTF8Encoding]::new($false))
if ((Get-FileHash -LiteralPath $clientJar -Algorithm SHA256).Hash -ne $jarHash) { throw 'Client jar mismatch' }
if ((Get-FileHash -LiteralPath $serverJar -Algorithm SHA256).Hash -ne $serverHash) { throw 'Server jar unexpectedly changed' }
$installed = Get-Content -Raw -LiteralPath (Join-Path $targetPack 'assets/jurassicreborn/sounds.json') | ConvertFrom-Json -AsHashtable
$activeLine = ([IO.File]::ReadAllLines($optionsFile) | Where-Object { $_.StartsWith('resourcePacks:') })
$active = @($activeLine.Substring('resourcePacks:'.Length) | ConvertFrom-Json)
if ($active[-1] -ne $packId -or $installed.Count -ne $sourceSounds.Count) { throw 'Resource pack installation mismatch' }
$zip = [IO.Compression.ZipFile]::OpenRead($clientJar)
try {
    if (!$zip.GetEntry('com/example/examplemod/DinosaurAudio.class') -or !$zip.GetEntry('dinosaur-audio.json')) {
        throw 'Missing audio handler in installed jar'
    }
} finally { $zip.Dispose() }
$report = [ordered]@{
    installedAt = (Get-Date -Format o)
    scope = 'singleplayer-client-only'
    radius = 50
    events = $installed.Count
    samples = @($installed.Values | ForEach-Object { $_.sounds }).Count
    backup = $backup
    clientJarSha256 = $jarHash
    serverJarUnchanged = $true
    mapModified = $false
    packEnabledLast = $true
    check = 'offline-build-and-file-validation-only'
    inGameListeningTest = $false
}
$report | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root 'verification/dinosaur-audio-singleplayer-check.json') -Encoding utf8NoBOM
$report | ConvertTo-Json
