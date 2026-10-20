param(
    [Parameter(Mandatory=$true)][string]$Name,
    [ValidateSet('runtime','render')][string]$Destination = 'render'
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$source = Join-Path $root 'runtime/server/jurassic-city-v2'
$parent = if ($Destination -eq 'runtime') { Join-Path $root 'runtime/server' } else { Join-Path $root 'tools/unmined' }
$target = Join-Path $parent $Name
if (-not (Test-Path -LiteralPath $source -PathType Container)) { throw "World missing: $source" }
if (Test-Path -LiteralPath $target) { throw "Snapshot already exists: $target" }
$status = & (Join-Path $root 'runtime/server/control.ps1') 'parkbuild status'
if ($status -notmatch 'done=true|^idle$') { throw "Builder active: $status" }
$flushed = & (Join-Path $root 'runtime/server/control.ps1') 'save-all flush'
if (-not $?) { throw "save-all flush failed: $flushed" }
$saveOff = $false
try {
    $off = & (Join-Path $root 'runtime/server/control.ps1') 'save-off'
    if (-not $?) { throw "save-off failed: $off" }
    $saveOff = $true
    New-Item -ItemType Directory -Path $target -ErrorAction Stop | Out-Null
    & robocopy $source $target /E /XF session.lock /R:1 /W:1 /NFL /NDL /NJH /NJS | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed with code $LASTEXITCODE" }
    if (-not (Test-Path -LiteralPath (Join-Path $target 'level.dat'))) { throw 'Copied snapshot lacks level.dat' }
    if (-not (Test-Path -LiteralPath (Join-Path $target 'region') -PathType Container)) { throw 'Copied snapshot lacks region folder' }
    Write-Output $target
} finally {
    if ($saveOff) {
        $on = & (Join-Path $root 'runtime/server/control.ps1') 'save-on'
        if (-not $?) { throw "save-on failed: $on" }
    }
}
