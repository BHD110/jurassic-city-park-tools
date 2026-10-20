$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$instance = Join-Path $project 'video/capture-instance'
$output = Join-Path $project 'video/capture'
if (-not (Test-Path -LiteralPath $instance)) { throw 'Prepare the capture copy first with prepare-video-capture.ps1' }
$running = Get-CimInstance Win32_Process | Where-Object {$_.Name -eq 'java.exe' -and $_.CommandLine -like "*$instance*"}
if ($running) { throw 'Capture instance is already running' }
[IO.File]::WriteAllText((Join-Path $output 'control.json'), '{}', [Text.UTF8Encoding]::new($false))
$ff = (Get-Command ffmpeg).Source
$extra = @("-Dparkcamera.control=$(Join-Path $output 'control.json')", "-Dparkcamera.output=$output", "-Dparkcamera.ffmpeg=$ff")
& (Join-Path $PSScriptRoot 'launch-client.ps1') -GameDirectoryOverride $instance -QuickPlayWorld 'Jurassic City Park - Interior Lights' -ExtraJvmArgs $extra -Width 1280 -Height 720
