param([long]$TargetHandle,[int]$X,[int]$Y,[int]$Count=2,[int]$Gap=100)
$ErrorActionPreference='Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class VideoClickTest {
 [StructLayout(LayoutKind.Sequential)] public struct POINT {public int X;public int Y;}
 [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr c);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int c);
 [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h,int i);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out RECT r);
 [StructLayout(LayoutKind.Sequential)] public struct RECT{public int left;public int top;public int right;public int bottom;}
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll",SetLastError=true)] public static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int w,int height,uint flags);
 [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT p);
 [DllImport("user32.dll")] public static extern bool IsChild(IntPtr parent,IntPtr child);
 [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr h);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
 [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h,System.Text.StringBuilder name,int length);
 public static string Describe(long root,int x,int y){var h=WindowFromPoint(new POINT{X=x,Y=y});uint p;GetWindowThreadProcessId(h,out p);var name=new System.Text.StringBuilder(100);GetClassName(h,name,100);uint rp;GetWindowThreadProcessId(new IntPtr(root),out rp);RECT r;GetWindowRect(new IntPtr(root),out r);return "target="+root+" pid="+rp+" rect="+r.left+","+r.top+","+r.right+","+r.bottom+" ex="+GetWindowLong(new IntPtr(root),-20)+" hit="+h.ToInt64()+" pid="+p+" class="+name+" parent="+GetParent(h).ToInt64();}
 [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint x,uint y,uint data,UIntPtr extra);
 public static bool Hit(long parent,int x,int y){var p=new POINT{X=x,Y=y};var h=WindowFromPoint(p);return h==new IntPtr(parent)||IsChild(new IntPtr(parent),h);}
}
'@
[VideoClickTest]::SetThreadDpiAwarenessContext([IntPtr](-4))|Out-Null
$taskOriginal=New-Object VideoClickTest+POINT
[VideoClickTest]::GetCursorPos([ref]$taskOriginal)|Out-Null
try{
 [VideoClickTest]::ShowWindow([IntPtr]$TargetHandle,9)|Out-Null
 [VideoClickTest]::SetForegroundWindow([IntPtr]$TargetHandle)|Out-Null
 $taskPositioned=[VideoClickTest]::SetWindowPos([IntPtr]$TargetHandle,[IntPtr](-1),0,0,0,0,3)
 if(-not $taskPositioned){throw ('Cannot position test window: '+[Runtime.InteropServices.Marshal]::GetLastWin32Error())}
 Start-Sleep -Milliseconds 100
 for($i=0;$i-lt $Count;$i++){
  if(-not [VideoClickTest]::Hit($TargetHandle,$X,$Y)){throw ('Test application is covered; refusing to click another window. '+[VideoClickTest]::Describe($TargetHandle,$X,$Y))}
  [VideoClickTest]::SetCursorPos($X,$Y)|Out-Null
  [VideoClickTest]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
  Start-Sleep -Milliseconds 40
  [VideoClickTest]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
  if($i -lt $Count-1){Start-Sleep -Milliseconds $Gap}
 }
}finally{[VideoClickTest]::SetCursorPos($taskOriginal.X,$taskOriginal.Y)|Out-Null}

