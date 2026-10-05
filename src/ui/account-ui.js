async function renderAccount(){
 const s=await api.accountStatus();if(view!=='account')return;
 $('.main').innerHTML=`<div class="top"><div><h1>账号与 B 站</h1></div><button id="guide">新手指引</button></div><div class="settings-card"><h2>${s.connected?esc(s.username):'登录你的观影账号'}</h2><p>${s.connected?(s.remote?'已连接在线服务 · 使用同一服务的另一台 Windows 可同步笔记和截图':'仅本机联动 · 电脑关机后不可用；另一台电脑不能用此地址同步'):'首次登录会将本机日记绑定到该账号及服务，以后继续使用同一账号。'}</p><p class="details-path">${esc(s.url)}</p><p class="error">${esc(s.localError||s.error)}</p><p>最近成功同步：${s.lastSync?new Date(s.lastSync).toLocaleString('zh-CN'):'尚未同步'}</p><div class="row wrap">${s.connected?'<button class="primary" id="sync-now">立即同步</button><button id="logout">退出登录</button>':'<button class="primary" id="login">登录 / 注册</button>'}${s.conflicts?'<button id="conflicts">处理 '+s.conflicts+' 条冲突</button>':''}</div><p class="notice">同步影片档案、进度、笔记、截图及 B 站链接；不会上传整部视频、外挂字幕或本机文件路径。跨电脑需要单独部署在线服务。暂未提供手机和 iPad 客户端。</p></div><div class="settings-card"><h2>电脑 B 站插件</h2><p>直接在 B 站网页摘记，保存原台词、片段起止点和画面，然后回到观影整理、回看或导出台词拼图。插件需使用相同的服务地址和账号。</p><button id="extension">打开插件文件夹</button><p>打开浏览器扩展管理页 → 开启开发者模式 → 加载解压缩的扩展 → 选择打开的文件夹。固定插件图标，在 B 站视频页点击它并登录。</p><small>仅支持电脑网页端。字幕只取播放器提供的原文，取不到时保留截图并手动填写，不翻译。</small></div>`;
 on('#guide',()=>beginnerGuide());on('#extension',()=>api.openExtension());on('#login',()=>accountLoginDialog(s));on('#logout',async()=>{await api.accountLogout();renderAccount()});on('#sync-now',async()=>{$('#sync-now').disabled=true;try{await api.accountSync();await refresh();toast('同步完成')}finally{renderAccount()}});on('#conflicts',accountConflictsDialog);
}
function accountLoginDialog(status){
 formDialog('登录 / 注册观影账号',`<label>服务地址<input id="account-url" type="url" required value="${esc(status.url)}"></label><small>默认地址仅用于本机。跨电脑填写已部署服务的 HTTPS 地址，两台电脑填同一个地址。</small><label>账号<input id="account-name" required autocomplete="username" value="${esc(status.username)}" placeholder="英文、数字或邮箱"></label><label>密码<input id="account-password" type="password" required minlength="10" autocomplete="current-password"></label><label class="check"><input id="account-register" type="checkbox">第一次使用此服务，注册新账号</label><label class="check"><input id="account-migrate" type="checkbox">改连新服务 / 账号并将当前日记上传（会先备份）</label><label>注册邀请码（在线服务需要）<input id="account-code" type="password"></label><p class="notice">首次登录绑定当前日记。密码不写入笔记，登录凭据由 Windows 加密保存。</p>`,async()=>{await api.accountLogin({url:$('#account-url').value,username:$('#account-name').value,password:$('#account-password').value,register:$('#account-register').checked,setupCode:$('#account-code').value,migrate:$('#account-migrate').checked});closeDialog();await api.accountSync();await refresh();renderAccount()},'登录并同步');
}
async function accountConflictsDialog(){
 const list=await api.accountConflicts();dialog('<h2>同一条记录有两个版本</h2><p>不会自动覆盖。选择保留哪一版；处理前建议在偏好与备份中保存日记备份。</p>'+list.map((c,i)=>`<div class="settings-card"><h3>${esc(c.local.value?.title||c.local.value?.text||c.remote?.value?.title||c.local.key)}</h3><p>本机：${esc(c.local.deleted?'已删除':String(JSON.stringify(c.local.value)||'没有此记录').slice(0,500))}</p><p>服务：${esc(c.remote?.deleted?'已删除':String(JSON.stringify(c.remote?.value)||'服务端没有此记录').slice(0,500))}</p><button data-local="${i}">保留本机版</button> <button data-remote="${i}">保留服务版</button></div>`).join('')+'<div class="buttons"><button id="cancel">稍后处理</button></div>');
 for(const choice of ['local','remote'])$$('[data-'+choice+']').forEach(b=>b.onclick=()=>safe(async()=>{b.disabled=true;await api.accountResolve(list[Number(b.dataset[choice])].local.key,choice);await refresh();closeDialog();renderAccount()}));
}
function beginnerGuide(step=0){
 const steps=[
 ['欢迎来到观影','本机影片继续原画播放。B 站插件让你直接在浏览器做笔记；统一账号负责联动这些记录。视频文件暂不上传云端。'],
 ['先建立账号','从「账号与 B 站」登录或注册。默认本机地址用于这台电脑的插件联动。真正跨电脑需要部署 HTTPS 服务。'],
 ['安装 B 站插件','打开插件文件夹，到 Edge / Chrome 扩展管理页开启开发者模式并加载该文件夹。固定图标，在 B 站视频页点击，填写同一服务地址及账号。'],
 ['边看边留住触动','插件 N 摘一句、S 截图、B 收藏画面；I 起点、O 终点。先在面板开启快捷键，输入文字时快捷键停用。台词只保存原文，取不到时手填。'],
 ['回味与同步','观影登录后每 20 秒同步一次，也可手动同步。摘记能跳回 B 站片段或导出两种拼图。插件断网记录留在待同步列表，重连后重试。'],
 ['换电脑前确认','两台 Windows 用相同在线服务和账号，完成同步后再换机。本机地址不是云端。已有视频需迁移或重新关联。iPad 暂不做，备份功能保留。']];
 dialog(`<div class="eyebrow">新手指引 ${step+1} / ${steps.length}</div><h2>${steps[step][0]}</h2><p>${steps[step][1]}</p><div class="buttons"><button id="cancel">稍后再看</button>${step?'<button id="guide-back">上一步</button>':''}<button class="primary" id="guide-next">${step===steps.length-1?'完成指引':'下一步'}</button></div>`);
 on('#guide-back',()=>beginnerGuide(step-1));on('#guide-next',async()=>{if(step<steps.length-1)return beginnerGuide(step+1);await api.saveSettings({guideDone:true});await refresh();closeDialog();render()});
}
api.onAccount(()=>safe(async()=>{await refresh();if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))return;if(view==='player')renderPanel();else if(!$('#modal').open)render()}));

