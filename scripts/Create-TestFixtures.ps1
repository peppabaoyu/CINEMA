$ErrorActionPreference='Stop'
$taskRoot=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$taskWork=[IO.Path]::GetFullPath((Join-Path $taskRoot '../../work'))
New-Item -ItemType Directory -Force -Path $taskWork | Out-Null
$taskMpv=Join-Path $taskRoot 'vendor/mpv/mpv.exe'
& $taskMpv --no-config --no-terminal --no-audio '--length=12' '--ovc=mpeg4' '--of=avi' ('--o='+ (Join-Path $taskWork 'test-film.avi')) 'av://lavfi:testsrc2=size=1280x720:rate=24'
if($LASTEXITCODE -ne 0){throw 'AVI fixture creation failed'}
& $taskMpv --no-config --no-terminal '--length=3' '--ovc=libx265' '--ovcopts=preset=ultrafast' '--oac=aac' '--audio-file=av://lavfi:sine=frequency=440:sample_rate=48000' ('--o='+ (Join-Path $taskWork 'test-hevc.mkv')) 'av://lavfi:testsrc2=size=1920x1080:rate=24'
if($LASTEXITCODE -ne 0){throw 'HEVC fixture creation failed'}
