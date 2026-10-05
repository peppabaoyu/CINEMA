const {spawn}=require('node:child_process');
const {EventEmitter}=require('node:events');
class Surface extends EventEmitter {
 static open(exe,parent){return new Promise((resolve,reject)=>{const s=new Surface;s.visible=false;s.dead=false;s.proc=spawn(exe,[parent],{windowsHide:true,stdio:['pipe','pipe','pipe']});let text='';s.proc.stdout.on('data',chunk=>{text+=chunk;let index;while((index=text.indexOf('\n'))>=0){const line=text.slice(0,index).trim();text=text.slice(index+1);if(!s.wid&&/^\d+$/.test(line)){s.wid=line;clearTimeout(timer);resolve(s);}else if(line==='mouse-double')s.emit('double-click');}});s.proc.on('error',reject);s.proc.on('exit',()=>{s.dead=true;clearTimeout(timer);if(!s.wid)reject(Error('画面窗口启动失败'));});const timer=setTimeout(()=>{s.proc.kill();reject(Error('画面窗口启动超时'));},10000);});}
 send(s){if(!this.dead)this.proc.stdin.write(s+'\n');}
 setBounds(b){this.send(`bounds ${b.x} ${b.y} ${b.width} ${b.height}`);}
 showInactive(){this.visible=true;this.send('show');}
 hide(){this.visible=false;this.send('hide');}
 isVisible(){return this.visible;}
 isDestroyed(){return this.dead;}
 destroy(){this.send('quit');}
}
module.exports={Surface};
