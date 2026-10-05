const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),crypto=require('node:crypto'),{Transform}=require('node:stream'),{pipeline}=require('node:stream/promises');
const {VIDEO,walk,natural,episode,readText,subtitles}=require('./core.cjs');
async function checksum(file,signal){const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file)){if(signal?.aborted)throw Error('已取消');hash.update(chunk);}return hash.digest('hex');}
function readableError(e){if(e.code==='ENOSPC')return '磁盘空间不足，请更换保存位置后重试';if(e.code==='EACCES'||e.code==='EPERM')return '没有读取原文件或写入保存位置的权限';if(e.code==='ENOENT')return '文件已移动、丢失或磁盘未连接';return e.message||String(e);}
async function verifiedCopy(source,folder,{signal,onProgress=()=>{}}={}){
 const before=await fsp.stat(source);if(!before.isFile()||!before.size)throw Error('请选择完整的非空视频文件');await fsp.mkdir(folder,{recursive:true});
 const disk=await fsp.statfs(folder);if(Number(disk.bavail)*Number(disk.bsize)<before.size+32*1024*1024)throw Object.assign(Error('磁盘空间不足'),{code:'ENOSPC'});
 const temp=path.join(folder,'.import-'+crypto.randomUUID()+'.partial'),hash=crypto.createHash('sha256');let bytes=0;
 try{
  const tap=new Transform({transform(chunk,enc,cb){hash.update(chunk);bytes+=chunk.length;onProgress({phase:'copying',bytes,total:before.size});cb(null,chunk)}});
  await pipeline(fs.createReadStream(source),tap,fs.createWriteStream(temp,{flags:'wx'}),{signal});
  const digest=hash.digest('hex'),after=await fsp.stat(source);if(after.size!==before.size||after.mtimeMs!==before.mtimeMs)throw Error('复制时原文件发生变化，请待下载完成后重试');
  const handle=await fsp.open(temp,'r+');try{await handle.sync()}finally{await handle.close()}
  onProgress({phase:'verifying',bytes:before.size,total:before.size});if(await checksum(temp,signal)!==digest)throw Error('副本校验失败，原文件仍安全保留');
  if(signal?.aborted)throw Error('已取消');const mediaFile=digest+path.extname(source).toLowerCase(),dest=path.join(folder,mediaFile);
  try{await fsp.stat(dest);if(await checksum(dest,signal)!==digest)throw Error('影库里已有副本校验不一致，请保留原文件并检查磁盘');await fsp.unlink(temp);}catch(e){if(e.code==='ENOENT')await fsp.rename(temp,dest);else throw e;}
  return {path:dest,mediaFile,sha256:digest,bytes:before.size,sourcePath:path.resolve(source),originalName:path.basename(source),storedAt:new Date().toISOString(),verified:true};
 }catch(e){await fsp.unlink(temp).catch(()=>{});if(signal?.aborted)throw Error('已取消，未完成的副本已清理');throw e;}
}
class Vault{
 constructor(store,defaultFolder,notify=()=>{}){this.store=store;this.defaultFolder=defaultFolder;this.notify=notify;this.state={running:false,files:[],duplicates:[]};this.controller=null;}
 folder(){return this.store.getSetting('mediaFolder')||this.defaultFolder;}
 info(){const entries=this.store.list().flatMap(i=>i.episodes),managed=entries.filter(e=>e.mediaFile&&e.verified);let freeBytes=null;try{let p=this.folder();while(!fs.existsSync(p)&&path.dirname(p)!==p)p=path.dirname(p);const d=fs.statfsSync(p);freeBytes=Number(d.bavail)*Number(d.bsize)}catch{}return {folder:this.folder(),freeBytes,storedCount:managed.length,storedBytes:[...new Map(managed.map(e=>[e.path,e.bytes||0])).values()].reduce((a,b)=>a+b,0),legacyCount:entries.filter(e=>e.path&&!e.mediaFile&&!/^https?:/.test(e.path)).length,remoteCount:entries.filter(e=>/^https?:/.test(e.path)).length};}
 emit(force=false){if(!force&&Date.now()-(this.lastNotify||0)<150)return;this.lastNotify=Date.now();this.notify(structuredClone(this.state));}
 cancel(){this.controller?.abort();return true;}
 async import(inputs,options={}){
  if(this.state.duplicates?.length)throw Error('请先处理上一批重复资源');if(this.state.running)throw Error('已有资源正在保存，请等这一批完成，或先取消');if(!Array.isArray(inputs)||!inputs.length)throw Error('请拖入视频或文件夹');
  this.controller=new AbortController();this.state={running:true,phase:'preparing',files:[],duplicates:[],added:0,skipped:0,upgraded:0,failed:0,started:Date.now()};this.emit(true);
  try{
   if(options.targetId){const target=this.store.get(options.targetId);if(target.kind!=='series')throw Error('请选择已有剧集');}
   const gathered=[];for(const input of inputs){if(typeof input!=='string')continue;try{const st=await fsp.stat(input);if(st.isDirectory())gathered.push(...walk(input));else if(VIDEO.test(input))gathered.push(path.resolve(input));}catch(e){this.state.files.push({source:input,name:path.basename(input),status:'failed',error:readableError(e)});this.state.failed++;}}
   const paths=[...new Set(gathered)].sort(natural.compare);if(!paths.length&&!this.state.failed)throw Error('没有找到视频文件，请拖入电影、剧集或包含视频的文件夹');if(paths.length>3000)throw Error('请分批导入，每批最多 3000 个视频');this.state.files.push(...paths.map(source=>({source,name:path.basename(source),status:'queued',percent:0})));this.emit(true);
   const knownMedia=this.store.getSetting('mediaInventory')||{};let kind=options.kind||'auto';if(kind==='auto')kind=paths.some(p=>episode(knownMedia[p]?.originalName||p).episode)?'series':'movie';let targetId=options.targetId||'';const title=options.title?.trim()||path.basename(path.dirname(paths[0]||'影片'));
   for(const task of this.state.files){if(task.status==='failed')continue;if(this.controller.signal.aborted){task.status='cancelled';continue;}try{
    task.status='copying';this.state.phase='copying';this.emit(true);
    let saved=await verifiedCopy(task.source,this.folder(),{signal:this.controller.signal,onProgress:p=>{task.status=p.phase;task.bytes=p.bytes;task.total=p.total;task.percent=p.phase==='verifying'?95:Math.floor(p.bytes/p.total*94);this.emit()}});
    const inventory=this.store.getSetting('mediaInventory')||{},previous=inventory[saved.path];if(previous?.sha256===saved.sha256&&path.resolve(task.source).toLowerCase()===saved.path.toLowerCase())saved={...saved,originalName:previous.originalName||saved.originalName,sourcePath:previous.sourcePath||saved.sourcePath};inventory[saved.path]=saved;this.store.setting('mediaInventory',inventory);
    let legacy=0;for(const item of this.store.list()){let dirty=false;for(const ep of item.episodes){if(ep.path&&!ep.mediaFile&&path.resolve(ep.path).toLowerCase()===saved.sourcePath.toLowerCase()){Object.assign(ep,saved);await this.copySidecar(ep,task.source);legacy++;dirty=true;}}if(dirty)this.store.put(item);}
    if(legacy){this.state.upgraded+=legacy;task.status='done';}else{
     const duplicate=this.store.list().flatMap(item=>item.episodes.map(ep=>ep.sha256===saved.sha256?{itemId:item.id,episodeId:ep.id,title:item.title,path:ep.path}:null).filter(Boolean))[0];
     if(duplicate){if(saved.path!==duplicate.path){await fsp.unlink(saved.path);saved.path=duplicate.path;saved.mediaFile=path.basename(duplicate.path);}task.status='duplicate';task.duplicate=duplicate;task.saved=saved;task.options={kind,title,targetId,category:options.category||''};this.state.skipped++;this.state.duplicates.push({task:task.name,source:task.source,duplicate});this.emit(true);continue;}
     const result=this.store.import([saved.path],{kind,title,targetId,category:options.category||'',media:{[saved.path]:saved}});this.state.added+=result.added;this.state.skipped+=result.skipped;task.status=result.skipped?'duplicate':'done';
     const item=this.store.list().find(i=>i.episodes.some(e=>e.path===saved.path));if(item){const ep=item.episodes.find(e=>e.path===saved.path);if(!ep.subtitle){await this.copySidecar(ep,task.source);this.store.put(item);}if(kind==='series')targetId=item.id;}
    }
    task.percent=100;task.savedPath=saved.path;task.sha256=saved.sha256;this.emit(true);
   }catch(e){task.status=this.controller.signal.aborted?'cancelled':'failed';task.error=readableError(e);if(task.status==='failed')this.state.failed++;this.emit(true);}}
   this.state.phase=this.controller.signal.aborted?'cancelled':(this.state.duplicates.length?'duplicates':'complete');return {...structuredClone(this.state),running:false};
  }finally{this.state.running=false;this.emit(true);this.controller=null;}
 }
 async resolveDuplicates(action='skip'){
  if(this.state.running)throw Error('请先等当前保存任务结束');
  if(!['skip','copy','replace'].includes(action))throw Error('未知的重复处理方式');
  const pending=this.state.files.filter(t=>t.status==='duplicate'&&t.saved);
  for(const task of pending){
   if(action==='skip'){task.status='skipped';continue;}
   if(action==='replace'&&task.duplicate){const item=this.store.get(task.duplicate.itemId),ep=item.episodes.find(e=>e.id===task.duplicate.episodeId);Object.assign(ep,task.saved);this.store.put(item);task.status='done';continue;}
   const saved=task.saved;const result=this.store.import([saved.path],{...task.options,media:{[saved.path]:saved},allowDuplicate:true});this.state.added+=result.added;task.status='done';
  }
  this.state.duplicates=[];this.state.phase='complete';this.emit(true);return {...structuredClone(this.state),running:false};
 }
 async copySidecar(ep,source){if(ep.subtitle)return;const base=source.slice(0,-path.extname(source).length);for(const ext of ['.srt','.ass','.ssa','.vtt']){const candidate=base+ext;if(!fs.existsSync(candidate))continue;try{const relative='subtitles/'+crypto.randomUUID()+ext;await fsp.mkdir(path.join(this.store.root,'subtitles'),{recursive:true});await fsp.copyFile(candidate,path.join(this.store.root,relative));ep.subtitle=relative;ep.cues=subtitles(readText(candidate));break;}catch(e){ep.subtitleWarning=readableError(e);}}}
 async preserveExisting(){const paths=this.store.list().flatMap(i=>i.episodes.filter(e=>e.path&&!e.mediaFile&&!/^https?:/.test(e.path)).map(e=>e.path));if(!paths.length)return {added:0,skipped:0,upgraded:0,failed:0,files:[]};return this.import(paths,{kind:'movie'});}
}
module.exports={Vault,verifiedCopy,checksum};
