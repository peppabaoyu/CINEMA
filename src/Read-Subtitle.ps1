param([string]$ImagePath)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Drawing
[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null
$taskAwaitMethod=[System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {$_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'} | Select-Object -First 1
function Wait-OcrOperation($Operation,$ResultType){$taskAsync=$taskAwaitMethod.MakeGenericMethod($ResultType).Invoke($null,@($Operation));$taskAsync.Wait();return $taskAsync.Result}
$taskTemp=$ImagePath+'.ocr.png'
$taskSource=$null;$taskCrop=$null;$taskGraphics=$null;$taskStream=$null
try {
 $taskSource=[Drawing.Bitmap]::FromFile($ImagePath)
 $taskWidth=[Math]::Min(2400,$taskSource.Width)
 $taskHeight=[int]([Math]::Round($taskSource.Height*.38*$taskWidth/$taskSource.Width))
 $taskCrop=New-Object Drawing.Bitmap $taskWidth,$taskHeight
 $taskGraphics=[Drawing.Graphics]::FromImage($taskCrop)
 $taskGraphics.DrawImage($taskSource,(New-Object Drawing.Rectangle(0,0,$taskWidth,$taskHeight)),0,[int]($taskSource.Height*.62),$taskSource.Width,[int]($taskSource.Height*.38),[Drawing.GraphicsUnit]::Pixel)
 $taskCrop.Save($taskTemp,[Drawing.Imaging.ImageFormat]::Png)
 $taskFile=Wait-OcrOperation ([Windows.Storage.StorageFile]::GetFileFromPathAsync($taskTemp)) ([Windows.Storage.StorageFile])
 $taskStream=Wait-OcrOperation ($taskFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
 $taskDecoder=Wait-OcrOperation ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($taskStream)) ([Windows.Graphics.Imaging.BitmapDecoder])
 $taskBitmap=Wait-OcrOperation ($taskDecoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
 $taskEngine=[Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
 if(-not $taskEngine){throw 'Windows OCR language pack is unavailable'}
 $taskResult=Wait-OcrOperation ($taskEngine.RecognizeAsync($taskBitmap)) ([Windows.Media.Ocr.OcrResult])
 $taskText=($taskResult.Lines | ForEach-Object {[regex]::Replace($_.Text,'(?<=[\p{IsCJKUnifiedIdeographs}\p{IsCJKSymbolsandPunctuation}])\s+(?=[\p{IsCJKUnifiedIdeographs}\p{IsCJKSymbolsandPunctuation}])','')}) -join "`n"
 @{text=$taskText;language=$taskEngine.RecognizerLanguage.LanguageTag} | ConvertTo-Json -Compress
 $taskBitmap.Dispose()
}finally{
 if($taskStream){$taskStream.Dispose()};if($taskGraphics){$taskGraphics.Dispose()};if($taskCrop){$taskCrop.Dispose()};if($taskSource){$taskSource.Dispose()}
 if(Test-Path -LiteralPath $taskTemp){Remove-Item -LiteralPath $taskTemp -Force}
}
