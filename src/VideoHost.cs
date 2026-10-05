using System;
using System.Windows.Forms;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Diagnostics;
class VideoHost {
 [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 [DllImport("user32.dll")] static extern IntPtr SetParent(IntPtr child,IntPtr parent);
 [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h,int index);
 [DllImport("user32.dll")] static extern int SetWindowLong(IntPtr h,int index,int value);
 [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int w,int height,uint flags);
 [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h,int command);
 [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
 [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT point);
 [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(POINT point);
 [DllImport("user32.dll")] static extern bool IsChild(IntPtr parent,IntPtr child);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
 [DllImport("user32.dll")] static extern uint GetDoubleClickTime();
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window,out RECT rect);
 [StructLayout(LayoutKind.Sequential)] struct RECT {public int Left;public int Top;public int Right;public int Bottom;}
 [StructLayout(LayoutKind.Sequential)] struct POINT {public int X;public int Y;}
 [STAThread] static void Main(string[] args) {
  SetThreadDpiAwarenessContext(new IntPtr(-4));
  var form=new Form();form.FormBorderStyle=FormBorderStyle.None;form.ShowInTaskbar=false;form.BackColor=System.Drawing.Color.Black;
  var parent=new IntPtr(long.Parse(args[0]));var handle=form.Handle;SetParent(handle,parent);
  SetWindowLong(handle,-16,(GetWindowLong(handle,-16)&unchecked((int)~0x80000000))|0x40000000);
  Console.WriteLine(handle.ToInt64());Console.Out.Flush();
  Task.Run(()=>{string line;while((line=Console.ReadLine())!=null){var parts=line.Split(' ');try{form.BeginInvoke(new Action(()=>{switch(parts[0]){case "bounds":SetWindowPos(handle,IntPtr.Zero,int.Parse(parts[1]),int.Parse(parts[2]),int.Parse(parts[3]),int.Parse(parts[4]),0x0010);break;case "show":ShowWindow(handle,4);break;case "hide":ShowWindow(handle,0);break;case "quit":form.Close();break;}}));}catch{break;}}try{form.BeginInvoke(new Action(()=>form.Close()));}catch{}});
  // The video is painted by an external child window. Its mouse messages do
  // not reliably reach either WinForms events or mpv's embedded-window input.
  // Observe button transitions only while the pointer hits this visible video.
  var clock=Stopwatch.StartNew();bool held=false;long first=-10000;POINT anchor=new POINT();
  var clicks=new System.Windows.Forms.Timer();clicks.Interval=15;
  clicks.Tick+=(sender,e)=>{bool down=(GetAsyncKeyState(1)&0x8000)!=0;if(down&&!held){POINT p;if(GetCursorPos(out p)){var hit=WindowFromPoint(p);RECT bounds;if(IsWindowVisible(handle)&&GetWindowRect(handle,out bounds)&&p.X>=bounds.Left&&p.X<bounds.Right&&p.Y>=bounds.Top&&p.Y<bounds.Bottom&&(hit==handle||IsChild(handle,hit)||hit==parent||IsChild(parent,hit))){long now=clock.ElapsedMilliseconds;int radius=Math.Max(8,Math.Max(SystemInformation.DoubleClickSize.Width,SystemInformation.DoubleClickSize.Height));if(now-first<=GetDoubleClickTime()&&Math.Abs(p.X-anchor.X)<=radius&&Math.Abs(p.Y-anchor.Y)<=radius){first=-10000;Console.WriteLine("mouse-double");Console.Out.Flush();}else{first=now;anchor=p;}}else first=-10000;}}held=down;};
  clicks.Start();Application.Run();clicks.Dispose();
 }
}
