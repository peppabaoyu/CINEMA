// Reuse the documented real mouse verification of installed 0.6.0 only
// when every player/input component involved in that test is unchanged.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),asar=require('@electron/asar');
const [installed,staged]=process.argv.slice(2),oldArchive=path.join(installed,'resources','app.asar'),newArchive=path.join(staged,'resources','app.asar');
const read=(archive,name)=>asar.extractFile(archive,path.normalize(name)),version=JSON.parse(read(oldArchive,'package.json')).version;
assert(['0.6.0','0.7.0','0.8.0','0.8.1'].includes(version),'Only a previously verified installed player may be reused');
for(const name of ['src/player.cjs','src/surface.cjs','src/keys.lua'])assert(read(oldArchive,name).equals(read(newArchive,name)),'Changed '+name);
for(const file of ['resources/host/VideoHost.exe','resources/host/keys.lua'])assert(fs.readFileSync(path.join(installed,file)).equals(fs.readFileSync(path.join(staged,file))),'Changed '+file);
function lines(archive,file,pattern){return read(archive,file).toString().split(/\r?\n/).filter(l=>pattern.test(l))}
for(const [file,pattern]of [['src/main.cjs',/^function videoDoubleClick|^ control:/],['src/ui/app.js',/^function renderPlayer|^document.addEventListener\('keydown'/]]){const before=lines(oldArchive,file,pattern);assert(before.length,'Missing player input code');assert.deepEqual(before,lines(newArchive,file,pattern),'Changed player input in '+file)}
console.log('Player, native video host, double-click and keyboard handlers match the previously verified installed player.');


