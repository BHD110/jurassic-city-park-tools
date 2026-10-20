param([int]$Radius = 50)
$ErrorActionPreference = 'Stop'
if ($Radius -lt 1 -or $Radius -gt 256) { throw 'Invalid sound radius' }
$root = Split-Path $PSScriptRoot -Parent
$jar = Join-Path $root 'runtime/server/mods/jurassicreborn-1.4.2.jar'
$stage = Join-Path $root 'runtime/dinosaur-audio-stage'
$pack = Join-Path $stage 'Jurassic Dinosaur Audio 50'
$assetDir = Join-Path $pack 'assets/jurassicreborn'
$resourceDir = Join-Path $root 'builder/MDK-1.21.1-ModDevGradle-main/src/main/resources'
New-Item -ItemType Directory -Force -Path $assetDir, $resourceDir | Out-Null
$zip = [IO.Compression.ZipFile]::OpenRead($jar)
try {
    $reader = [IO.StreamReader]::new($zip.GetEntry('assets/jurassicreborn/sounds.json').Open())
    try { $original = $reader.ReadToEnd() | ConvertFrom-Json -AsHashtable } finally { $reader.Dispose() }
} finally { $zip.Dispose() }
$sounds = [ordered]@{}
$events = [Collections.Generic.List[string]]::new()
$samples = 0
foreach ($name in ($original.Keys | Sort-Object)) {
    $definition = $original[$name]
    $dinosaurSamples = @($definition.sounds | Where-Object {
        $sampleName = if ($_ -is [string]) { $_ } else { $_.name }
        $sampleName -like 'jurassicreborn:dinosaurs/*'
    })
    if ($dinosaurSamples.Count -eq 0) { continue }
    if ($dinosaurSamples.Count -ne $definition.sounds.Count) { throw "Mixed sound event: $name" }
    $replacement = $definition.Clone()
    $replacement.replace = $true
    $replacement.sounds = @($definition.sounds | ForEach-Object {
        $sample = if ($_ -is [string]) { @{name = $_} } else { $_.Clone() }
        if ($sample.type -eq 'event') { throw "Unexpected nested sound event: $name" }
        $sample.attenuation_distance = $Radius
        $samples++
        $sample
    })
    $sounds[$name] = $replacement
    $events.Add("jurassicreborn:$name")
}
if ($events.Count -eq 0) { throw 'No dinosaur sound events found' }
$sounds | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $assetDir 'sounds.json') -Encoding utf8NoBOM
@{pack = @{pack_format = 34; description = "Jurassic dinosaur sounds - $Radius block radius"}} |
    ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $pack 'pack.mcmeta') -Encoding utf8NoBOM
@{radius = $Radius; events = @($events)} | ConvertTo-Json -Depth 5 |
    Set-Content -LiteralPath (Join-Path $resourceDir 'dinosaur-audio.json') -Encoding utf8NoBOM
@{radius = $Radius; events = $events.Count; samples = $samples; pack = $pack; volumeAndPitchUnchanged = $true} |
    ConvertTo-Json | Set-Content -LiteralPath (Join-Path $stage 'manifest.json') -Encoding utf8NoBOM
Get-Content -LiteralPath (Join-Path $stage 'manifest.json')
