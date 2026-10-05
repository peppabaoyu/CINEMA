param([string]$SourceDirectory=(Join-Path $PSScriptRoot '../release/win-unpacked'),[string]$TestedAppHash='')
$ErrorActionPreference='Stop'
$taskProject=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$taskSource=(Resolve-Path -LiteralPath $SourceDirectory).Path
$taskDesktop=[Environment]::GetFolderPath('Desktop')
$taskParent=Join-Path $taskDesktop '观影'
$taskTarget=Join-Path $taskParent 'win-unpacked'
$taskNonce=Get-Date -Format 'yyyyMMdd-HHmmss'
$taskStage=Join-Path $taskParent ('win-unpacked.update-'+$taskNonce)
$taskOld=Join-Path $taskParent ('win-unpacked.previous-'+$taskNonce)
$taskData=Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'guanying-diary'
function Assert-ProgramPath([string]$Candidate){
 $resolved=[IO.Path]::GetFullPath($Candidate)
 $parent=[IO.Path]::GetFullPath($taskParent).TrimEnd('\')+'\'
 if(-not $resolved.StartsWith($parent,[StringComparison]::OrdinalIgnoreCase)){throw "Outside program directory: $resolved"}
 if(Test-Path -LiteralPath $resolved){
  if((Get-Item -LiteralPath $resolved).Attributes -band [IO.FileAttributes]::ReparsePoint){throw "Refusing reparse point: $resolved"}
  if(Get-ChildItem -LiteralPath $resolved -Recurse -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }){throw 'Refusing nested reparse point'}
 }
 return $resolved
}
function Manifest([string]$Folder){
 $base=(Resolve-Path -LiteralPath $Folder).Path
 @(Get-ChildItem -LiteralPath $base -Recurse -File | Where-Object Name -ne 'install-manifest.json' | ForEach-Object {$_.FullName.Substring($base.Length)+'|'+(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}) | Sort-Object
}
if(-not(Test-Path -LiteralPath (Join-Path $taskSource '观影.exe'))){throw 'Missing executable'}
if(-not(Test-Path -LiteralPath (Join-Path $taskSource 'resources/mpv/mpv.exe'))){throw 'Missing player engine'}
if(Test-Path -LiteralPath $taskTarget){
 Assert-ProgramPath $taskTarget | Out-Null
 $oldManifest=Join-Path $taskTarget 'install-manifest.json'
 if(-not(Test-Path -LiteralPath $oldManifest)){throw 'Existing directory has no installation manifest; preserving it.'}
 $known=Get-Content -Raw -LiteralPath $oldManifest | ConvertFrom-Json
 $unexpected=Get-ChildItem -LiteralPath $taskTarget -Recurse -File | Where-Object { $_.Name -ne 'install-manifest.json' -and $_.FullName.Substring($taskTarget.Length) -notin $known }
 if($unexpected){throw 'Existing program directory contains extra files; preserving user content.'}
}
New-Item -ItemType Directory -Path $taskStage -Force | Out-Null
Get-ChildItem -LiteralPath $taskSource -Force | Copy-Item -Destination $taskStage -Recurse
if(Compare-Object (Manifest $taskSource) (Manifest $taskStage)){throw 'Staged copy checksum mismatch'}
@(Get-ChildItem -LiteralPath $taskStage -Recurse -File | ForEach-Object {$_.FullName.Substring($taskStage.Length)}) | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskStage 'install-manifest.json') -Encoding utf8
Write-Output 'Staged program verified. Running packaged desktop tests.'
$env:GUANYING_EXECUTABLE=Join-Path $taskStage '观影.exe'
try {
 if($TestedAppHash){
  $taskHash=(Get-FileHash -LiteralPath (Join-Path $taskStage 'resources/app.asar')).Hash
  if($taskHash -ne $TestedAppHash){throw 'Previous verification does not match staged app'}
  Write-Output 'Reusing successful packaged tests for this exact application hash.'
 }else{
 & node (Join-Path $taskProject 'test/mouse.cjs')
 if($LASTEXITCODE -ne 0){throw 'Actual Windows mouse test failed; current installation untouched.'}
 & node (Join-Path $taskProject 'test/batch-desktop.cjs')
 if($LASTEXITCODE -ne 0){throw 'Batch management test failed; current installation untouched.'}
 & node (Join-Path $taskProject 'test/account-desktop.cjs')
 if($LASTEXITCODE -ne 0){throw 'Packaged account test failed; current installation untouched.'}
 & node (Join-Path $taskProject 'test/import.cjs')
 if($LASTEXITCODE -ne 0){throw 'Packaged managed-import test failed; current installation untouched.'}
 & node (Join-Path $taskProject 'test/desktop.cjs')
 if($LASTEXITCODE -ne 0){throw 'Packaged desktop test failed; current installation untouched.'}
 & node (Join-Path $taskProject 'test/experience.cjs')
 if($LASTEXITCODE -ne 0){throw 'Packaged experience test failed; current installation untouched.'}
 }
}finally{Remove-Item Env:GUANYING_EXECUTABLE -ErrorAction SilentlyContinue}
$taskExe=Join-Path $taskTarget '观影.exe'
$taskRunning=@(Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -eq $taskExe -and $_.CommandLine -notmatch '--type='})
foreach($p in $taskRunning){$process=Get-Process -Id $p.ProcessId;if(-not $process.CloseMainWindow()){throw 'Cannot close existing application safely.'}}
$deadline=(Get-Date).AddSeconds(20)
do{$running=@(Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -eq $taskExe});if(-not $running.Count){break};Start-Sleep -Milliseconds 300}while((Get-Date)-lt $deadline)
if($running.Count){throw 'Existing application still running; preserving installation.'}
& node (Join-Path $PSScriptRoot 'backup-data.cjs') $taskData (Join-Path $taskData ('update-backups/'+$taskNonce+'.zip'))
if($LASTEXITCODE -ne 0){throw 'Data backup failed'}
$taskBefore=$null
if(Test-Path -LiteralPath (Join-Path $taskData 'diary.sqlite')){
 $taskBefore=& node (Join-Path $PSScriptRoot 'db-fingerprint.cjs') (Join-Path $taskData 'diary.sqlite')
 if($LASTEXITCODE -ne 0){throw 'Cannot verify existing database contents'}
}
Assert-ProgramPath $taskTarget|Out-Null
Assert-ProgramPath $taskStage|Out-Null
Assert-ProgramPath $taskOld|Out-Null
$taskHadOld=Test-Path -LiteralPath $taskTarget
if($taskHadOld){Move-Item -LiteralPath $taskTarget -Destination $taskOld}
try{
 Move-Item -LiteralPath $taskStage -Destination $taskTarget
 $taskNew=Start-Process -FilePath $taskExe -WorkingDirectory $taskTarget -WindowStyle Normal -PassThru
 Start-Sleep -Seconds 4
 if($taskNew.HasExited){throw 'New program exited during startup'}
 if($taskBefore){
  $taskAfter=& node (Join-Path $PSScriptRoot 'db-fingerprint.cjs') (Join-Path $taskData 'diary.sqlite')
  if($LASTEXITCODE -ne 0 -or $taskAfter -ne $taskBefore){throw 'Data changed unexpectedly during update; keeping old program'}
 }
 $taskShell=New-Object -ComObject WScript.Shell
 $taskLink=$taskShell.CreateShortcut((Join-Path $taskDesktop '观影.lnk'))
 $taskLink.TargetPath=$taskExe
 $taskLink.WorkingDirectory=$taskTarget
 $taskLink.IconLocation=(Join-Path $taskTarget 'resources/app-icon-0.6.0.ico')+',0'
 $taskLink.Description='观影 · 私人的电影日记'
 $taskLink.Save()
}catch{
 if($taskNew -and -not $taskNew.HasExited){$taskNew.CloseMainWindow()|Out-Null;if(-not $taskNew.WaitForExit(10000)){throw 'New program still running; old program retained for recovery.'}}
 if($taskHadOld -and (Test-Path -LiteralPath $taskOld)){
  Assert-ProgramPath $taskTarget|Out-Null;Assert-ProgramPath $taskStage|Out-Null
  if(Test-Path -LiteralPath $taskTarget){Move-Item -LiteralPath $taskTarget -Destination $taskStage}
  Assert-ProgramPath $taskOld|Out-Null;Move-Item -LiteralPath $taskOld -Destination $taskTarget
 }
 throw
}
if($taskHadOld){Assert-ProgramPath $taskOld|Out-Null;Remove-Item -LiteralPath $taskOld -Recurse -Force}
Write-Output ('Desktop installation complete: '+$taskExe)
