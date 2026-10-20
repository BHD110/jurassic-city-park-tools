param(
    [Parameter(Mandatory = $true)]
    [string]$WorldPath,
    [Parameter(Mandatory = $true)]
    [string]$OutputRoot,
    [string]$Area,
    [switch]$WebOnly
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$exe = Join-Path $scriptRoot 'cli\unmined-cli_0.20.11-dev_win-64bit\unmined-cli.exe'

if (-not (Test-Path -LiteralPath $exe)) {
    throw "uNmINeD CLI not found: $exe"
}
if (-not (Test-Path -LiteralPath $WorldPath)) {
    throw "World folder not found: $WorldPath"
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
$imagePath = Join-Path $OutputRoot 'overview.png'
$webPath = Join-Path $OutputRoot 'web'

$common = @(
    '--world', (Resolve-Path -LiteralPath $WorldPath).Path,
    '--dimension', '0',
    '--shadows', '2d',
    '--blockrender', 'false',
    '--chunkprocessors', '8',
    '--log-level', 'information'
)
if ($Area) {
    $common += @('--area', $Area)
}

if (-not $WebOnly) {
    $imageArgs = @($common + @('--zoom', '-3', '--trim', '--output', $imagePath))
    & $exe image render @imageArgs
    if ($LASTEXITCODE -ne 0) { throw "uNmINeD image render failed: $LASTEXITCODE" }
}

New-Item -ItemType Directory -Force -Path $webPath | Out-Null
$webArgs = @($common + @('--output', $webPath, '--zoomout', '5', '--zoomin', '0', '--imageformat', 'png', '--force'))
& $exe web render @webArgs
if ($LASTEXITCODE -ne 0) { throw "uNmINeD web render failed: $LASTEXITCODE" }

if (-not $WebOnly) { Write-Output "Image: $imagePath" }
Write-Output "Web map: $(Join-Path $webPath 'index.html')"
