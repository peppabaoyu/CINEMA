Add-Type -AssemblyName System.Drawing
$taskAssetDirectory=Join-Path $PSScriptRoot '../src/ui'
$taskBitmap=New-Object Drawing.Bitmap 512,512
$taskGraphics=[Drawing.Graphics]::FromImage($taskBitmap)
$taskGraphics.SmoothingMode=[Drawing.Drawing2D.SmoothingMode]::AntiAlias
$taskGraphics.Clear([Drawing.Color]::Transparent)
$taskShape=New-Object Drawing.Drawing2D.GraphicsPath
$taskRadius=92
$taskShape.AddArc(0,0,$taskRadius*2,$taskRadius*2,180,90)
$taskShape.AddArc(512-$taskRadius*2,0,$taskRadius*2,$taskRadius*2,270,90)
$taskShape.AddArc(512-$taskRadius*2,512-$taskRadius*2,$taskRadius*2,$taskRadius*2,0,90)
$taskShape.AddArc(0,512-$taskRadius*2,$taskRadius*2,$taskRadius*2,90,90)
$taskShape.CloseFigure()
$taskBackground=New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml('#FFF12F'))
$taskInk=New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml('#5C2285'))
$taskGraphics.FillPath($taskBackground,$taskShape)
$taskFont=New-Object Drawing.Font('KaiTi',418,[Drawing.FontStyle]::Regular,[Drawing.GraphicsUnit]::Pixel)
$taskFormat=New-Object Drawing.StringFormat
$taskFormat.Alignment='Center'
$taskFormat.LineAlignment='Center'
$taskGraphics.TextRenderingHint=[Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$taskGraphics.DrawString('影',$taskFont,$taskInk,(New-Object Drawing.RectangleF(0,40,512,512)),$taskFormat)
$taskBitmap.Save((Join-Path $taskAssetDirectory 'icon.png'),[Drawing.Imaging.ImageFormat]::Png)
$taskStream=New-Object IO.MemoryStream
$taskWriter=New-Object IO.BinaryWriter($taskStream)
$taskSizes=@(16,24,32,48,64,128,256)
$taskImages=@()
foreach($taskSize in $taskSizes){
 $taskSmall=New-Object Drawing.Bitmap $taskSize,$taskSize
 $taskSmallGraphics=[Drawing.Graphics]::FromImage($taskSmall)
 $taskSmallGraphics.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
 $taskSmallGraphics.DrawImage($taskBitmap,0,0,$taskSize,$taskSize)
 $taskPngStream=New-Object IO.MemoryStream
 $taskSmall.Save($taskPngStream,[Drawing.Imaging.ImageFormat]::Png)
 $taskImages+=,@($taskSize,$taskPngStream.ToArray())
 $taskPngStream.Dispose();$taskSmallGraphics.Dispose();$taskSmall.Dispose()
}
$taskWriter.Write([UInt16]0);$taskWriter.Write([UInt16]1);$taskWriter.Write([UInt16]$taskSizes.Count)
$taskOffset=6+16*$taskSizes.Count
foreach($taskEntry in $taskImages){
 $taskDimension=if($taskEntry[0] -eq 256){0}else{$taskEntry[0]}
 $taskWriter.Write([Byte]$taskDimension);$taskWriter.Write([Byte]$taskDimension);$taskWriter.Write([Byte]0);$taskWriter.Write([Byte]0)
 $taskWriter.Write([UInt16]1);$taskWriter.Write([UInt16]32);$taskWriter.Write([UInt32]$taskEntry[1].Length);$taskWriter.Write([UInt32]$taskOffset)
 $taskOffset+=$taskEntry[1].Length
}
foreach($taskEntry in $taskImages){$taskWriter.Write([Byte[]]$taskEntry[1])}
$taskWriter.Flush();[IO.File]::WriteAllBytes((Join-Path $taskAssetDirectory 'icon.ico'),$taskStream.ToArray())
$taskWriter.Dispose();$taskStream.Dispose();$taskGraphics.Dispose();$taskBitmap.Dispose();$taskFont.Dispose();$taskBackground.Dispose();$taskInk.Dispose();$taskShape.Dispose();$taskFormat.Dispose()
