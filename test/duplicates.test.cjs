const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {Store}=require('../src/store.cjs'),{Vault}=require('../src/vault.cjs');
test('重复保留共用副本，替换保留笔记及进度',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'guanying-duplicate-')),source=path.join(root,'电影.mp4');fs.writeFileSync(source,'identical-video');
 const store=await Store.open(path.join(root,'data')),vault=new Vault(store,path.join(root,'media'));await vault.import([source]);const item=store.list()[0],ep=item.episodes[0];store.progress(item.id,ep.id,5,20);store.saveNote({itemId:item.id,episodeId:ep.id,start:1,end:2,kind:'quote',shots:[],text:'保留笔记'});
 await vault.import([source]);await vault.resolveDuplicates('copy');assert.equal(store.list().length,2);assert.equal(fs.readdirSync(path.join(root,'media')).length,1);
 const copy=store.list().find(i=>i.id!==item.id);store.remove(copy.id);await vault.import([source]);await vault.resolveDuplicates('replace');assert.equal(store.list().length,1);assert.equal(store.get(item.id).episodes[0].id,ep.id);assert.equal(store.get(item.id).episodes[0].position,5);assert.equal(store.notes(item.id)[0].text,'保留笔记');store.db.close();
});
