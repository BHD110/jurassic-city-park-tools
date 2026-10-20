param(
    [string]$Java = 'C:/Program Files/Eclipse Adoptium/jdk-21.0.10.7-hotspot/bin/java.exe',
    [string]$WorldDirectory
)
$ErrorActionPreference = 'Stop'
$server = Join-Path $PSScriptRoot 'server'
$props = @{}
Get-Content -LiteralPath (Join-Path $server 'server.properties') | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') { $props[$matches[1]] = $matches[2] }
}
$socket = [Net.Sockets.TcpClient]::new()
try {
    $connect = $socket.ConnectAsync('127.0.0.1', [int]$props['server-port'])
    try { $connect.Wait(800) | Out-Null } catch { }
    if ($socket.Connected) { throw "Minecraft is already listening on $($props['server-port'])" }
} finally { $socket.Dispose() }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stdout = Join-Path $server "city-upgrade-$stamp.out.log"
$stderr = Join-Path $server "city-upgrade-$stamp.err.log"
$launchArgs = @(
    '-Xms1G', '-Xmx5G', '@user_jvm_args.txt',
    '@libraries/net/neoforged/neoforge/21.1.262/win_args.txt', 'nogui'
)
if ($WorldDirectory) {
    $world = (Resolve-Path -LiteralPath $WorldDirectory).Path
    if (!(Test-Path -LiteralPath (Join-Path $world 'level.dat'))) { throw 'Existing world required.' }
    $launchArgs += @('--universe', ('"{0}"' -f (Split-Path $world -Parent)), '--world', ('"{0}"' -f (Split-Path $world -Leaf)))
}
$process = Start-Process -FilePath $Java -ArgumentList $launchArgs -WorkingDirectory $server -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
[pscustomobject]@{ pid = $process.Id; stdout = $stdout; stderr = $stderr; port = [int]$props['server-port'] } | ConvertTo-Json
