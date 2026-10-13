const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('webCinema',{
 call:(name,...args)=>ipcRenderer.invoke('gybrowser:call',name,...args),
 onState:fn=>ipcRenderer.on('gybrowser:state',(_,state)=>fn(state)),
 onAction:fn=>ipcRenderer.on('gybrowser:action',(_,action)=>fn(action))
});
