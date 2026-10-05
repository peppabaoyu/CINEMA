param([long]$TargetHandle)
$ErrorActionPreference='Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class VideoSpaceTest {
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool IsChild(IntPtr parent,IntPtr child);
 [DllImport("user32.dll")] public static extern void keybd_event(byte key,byte scan,uint flags,UIntPtr extra);
}
'@
$taskForeground=[VideoSpaceTest]::GetForegroundWindow()
if($taskForeground -ne [IntPtr]$TargetHandle -and -not [VideoSpaceTest]::IsChild([IntPtr]$TargetHandle,$taskForeground)){throw 'Test window is not foreground; refusing to send keys to another application.'}
[VideoSpaceTest]::keybd_event(32,0,0,[UIntPtr]::Zero)
try{Start-Sleep -Milliseconds 40}finally{[VideoSpaceTest]::keybd_event(32,0,2,[UIntPtr]::Zero)}
