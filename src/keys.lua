local function forward(name) mp.commandv('script-message','guanying-key',name) end
mp.add_forced_key_binding('SPACE','gy-pause',function() mp.commandv('cycle','pause') end)
mp.add_forced_key_binding('MBTN_LEFT','gy-click',function() end)
-- Native host handles real double clicks; suppress mpv's competing default action.
mp.add_forced_key_binding('MBTN_LEFT_DBL','gy-pause-double',function() end)
mp.add_forced_key_binding('LEFT','gy-back',function() mp.commandv('seek','-5','relative+exact') end,{repeatable=true})
mp.add_forced_key_binding('RIGHT','gy-next',function() mp.commandv('seek','5','relative+exact') end,{repeatable=true})
mp.add_forced_key_binding('.','gy-frame',function() mp.commandv('frame-step') end)
mp.add_forced_key_binding(',','gy-frameback',function() mp.commandv('frame-back-step') end)
for _,pair in ipairs({{'i','start'},{'o','end'},{'s','shot'},{'b','frame'},{'n','quote'},{'f','fullscreen'},{'ESC','escape'},{'m','mute'},{'h','immersive'},{'c','controls'},{'p','panel'},{'1','notesPanel'},{'2','subtitlesPanel'},{'3','episodesPanel'},{'t','tracks'},{'l','loadSubs'},{'e','exportNotes'},{'r','exitReview'},{'q','backLibrary'},{'a','archive'},{'v','speed'},{'UP','volumeUp'},{'DOWN','volumeDown'},{'F1','help'}}) do
 local key,action=pair[1],pair[2]
 mp.add_forced_key_binding(key,'gy-'..action,function() forward(action) end)
end
mp.add_forced_key_binding('d','gy-collect',function() forward('collectCues') end)
local last_reveal=0
mp.observe_property('mouse-pos','native',function(_,pos)
 if pos and pos.hover and pos.y and pos.y<32 and mp.get_time()-last_reveal>1 then last_reveal=mp.get_time();forward('reveal') end
end)
