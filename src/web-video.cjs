const {createHash}=require('node:crypto');
const {url}=require('./core.cjs');
function address(input){const value=String(input||'').trim();if(!value)return 'https://www.bing.com/';if(/^https?:\/\//i.test(value)||/^[\w\u0080-\uffff.-]+\.[a-z]{2,}(?::\d+)?(?:[/?#]|$)/i.test(value)||/^localhost:\d+/i.test(value))return url(value);if(/^[a-z][\w+.-]*:/i.test(value))throw Error('只支持 HTTP / HTTPS 网页');return 'https://www.bing.com/search?q='+encodeURIComponent(value)}
function identity(location,title){const u=new URL(url(location));for(const key of [...u.searchParams.keys()])if(/token|password|secret|session|authorization|^gy_|^t$|^spm|^utm_/i.test(key))u.searchParams.delete(key);u.hash='';const bili=u.hostname==='www.bilibili.com'&&u.pathname.match(/\/video\/(BV[\w]+)|\/bangumi\/play\/(ep\d+)/);let id;if(bili){const part=u.searchParams.get('p')||'1';id='bilibili-'+(bili[1]||bili[2])+'-p'+part;u.search=part==='1'?'':'?p='+encodeURIComponent(part)}else id='web-'+createHash('sha256').update(u.href).digest('hex').slice(0,32);return {id,url:u.href,title:String(title||u.hostname).slice(0,500),site:u.hostname,source:'web'}}
// Only fixed DOM operations execute in an unprivileged remote page.
function videoOperation(action,index=0,value){
 const videos=[...document.querySelectorAll('video')],v=videos[index];
 const read=el=>{const r=el.getBoundingClientRect(),t=el.currentTime||0;let sub={text:'',start:Math.max(0,t-3),end:Math.min(Number.isFinite(el.duration)?el.duration:t+3,t+3),exact:false};for(const track of [...el.textTracks])if(track.mode!=='disabled'&&track.activeCues?.length){const cues=[...track.activeCues];sub={text:cues.map(c=>c.text||'').join('\n'),start:Math.min(...cues.map(c=>c.startTime)),end:Math.max(...cues.map(c=>c.endTime)),exact:true};break}if(!sub.text)sub.text=[...document.querySelectorAll('.bpx-player-subtitle-panel-text,.subtitle-item-text,.bilibili-player-video-subtitle')].filter(n=>n.getBoundingClientRect().height>0).map(n=>n.textContent.trim()).filter(Boolean).join('\n').slice(0,20000);return {index:videos.indexOf(el),time:t,duration:Number.isFinite(el.duration)?el.duration:0,paused:el.paused,ready:el.readyState,width:el.videoWidth,height:el.videoHeight,src:el.currentSrc||el.src,area:Math.max(0,Math.min(innerWidth,r.right)-Math.max(0,r.left))*Math.max(0,Math.min(innerHeight,r.bottom)-Math.max(0,r.top)),rect:{x:r.x,y:r.y,width:r.width,height:r.height},viewport:{width:innerWidth,height:innerHeight},...sub}};
 if(action==='scan')return videos.map(read).filter(x=>x.area>0&&x.width>0);
 if(action==='editing'){let el=document.activeElement;while(el?.shadowRoot?.activeElement)el=el.shadowRoot.activeElement;return !!el&&(['INPUT','TEXTAREA','SELECT'].includes(el.tagName)||el.isContentEditable)}
 if(!v||v.readyState<1)throw Error('请先让网页视频开始播放');
 if(action==='read')return read(v);
 if(action==='pause')v.pause();
 if(action==='toggle'){if(v.paused)return v.play().then(()=>read(v));v.pause()}
 if(action==='seek')v.currentTime=Math.max(0,Math.min(Number(value)||0,Number.isFinite(v.duration)?Math.max(0,v.duration-.01):1e9));
 if(action==='speed')v.playbackRate=[1,1.25,1.5,2].includes(value)?value:1;
 if(action==='mute')v.muted=!v.muted;
 if(action==='frameStep'){v.pause();v.currentTime=Math.max(0,v.currentTime+(value<0?-1:1)/24)}
 if(action==='shot'){if(value==='frame'){try{const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);return {...read(v),data:c.toDataURL('image/png'),screen:false}}catch{}}return {...read(v),screen:true}}
 return read(v);
}
function script(action,index,value){return '('+videoOperation.toString()+')('+[action,index,value].map(v=>JSON.stringify(v)??'null').join(',')+')'}
module.exports={address,identity,script,videoOperation};
