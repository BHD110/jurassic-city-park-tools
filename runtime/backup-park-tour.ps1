param(
    [string]$BackupPrefix = 'before-park-tour',
    [string]$ReceiptName = 'park-tour-backup.json'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$receipt = Get-Content -LiteralPath (Join-Path $root 'verification/interior-singleplayer-export.json') -Raw | ConvertFrom-Json
$worlds = [ordered]@{ singleplayer = $receipt.installedSave; server = (Join-Path $PSScriptRoot 'server/jurassic-city-v2') }
$backup = Join-Path $root ("backups/$BackupPrefix-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$items = @()
foreach ($entry in $worlds.GetEnumerator()) {
    $lock = Join-Path $entry.Value 'session.lock'
    $handle = [IO.File]::Open($lock, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    $handle.Dispose()
    $target = Join-Path $backup $entry.Key
    New-Item -ItemType Directory -Path $target -Force | Out-Null
    Get-ChildItem -LiteralPath $entry.Value -Force | Copy-Item -Destination $target -Recurse -Force
    $before = @(Get-ChildItem -LiteralPath $entry.Value -Recurse -File)
    $after = @(Get-ChildItem -LiteralPath $target -Recurse -File)
    $bytes = ($before | Measure-Object Length -Sum).Sum
    if ($before.Count -ne $after.Count -or $bytes -ne ($after | Measure-Object Length -Sum).Sum) { throw 'Backup size mismatch.' }
    $items += [ordered]@{kind=$entry.Key;source=$entry.Value;backup=$target;files=$after.Count;bytes=$bytes}
}
Copy-Item -LiteralPath (Join-Path $root 'map/generated/upgrade-full.json') -Destination $backup
Copy-Item -LiteralPath (Join-Path $root 'map/generated/city-coaster-route.json') -Destination $backup
foreach ($file in @('map/generated/park-tour-route.json','verification/park-tour-expected.json')) {
    if (Test-Path -LiteralPath (Join-Path $root $file)) { Copy-Item -LiteralPath (Join-Path $root $file) -Destination $backup }
}
$report = [ordered]@{backup=$backup;worlds=$items;completedAt=(Get-Date).ToString('o')}
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $root "verification/$ReceiptName") -Encoding utf8
$report | ConvertTo-Json -Depth 5
