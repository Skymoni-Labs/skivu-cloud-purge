import {encoded,bytes} from './payload.mjs';
import {createPromptController} from './prompt-controller.mjs';
const status=document.getElementById('status'),detail=document.getElementById('detail'),apply=document.getElementById('apply'),revoke=document.getElementById('revoke');
const titles={checking:'正在核验…',injecting:'正在注入…',revoking:'正在撤销…',verified:'注入成功',inactive:'未注入',no_role:'尚未选择角色',unconfirmed:'未能确认注入'};
try{
 const data=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
 if(data.length!==bytes)throw Error('INVALID_PAYLOAD');
 const expected=new TextDecoder('utf-8',{fatal:true}).decode(data);
 const controller=createPromptController((method,params)=>Skivu.call(method,params),expected,state=>{
  status.textContent=titles[state.phase]||'未能确认注入';status.dataset.phase=state.phase;detail.textContent=state.detail||'';
  apply.disabled=state.busy||!state.roleId;revoke.disabled=state.busy||!state.roleId;apply.textContent=state.phase==='verified'?'重新核验':'注入原包提示词';
 });
 apply.onclick=()=>controller.apply();revoke.onclick=()=>controller.revoke();
 Skivu.on('context.changed',context=>controller.contextChanged(context));
 await controller.start();
}catch{
 status.textContent='未能确认注入';detail.textContent='请重新打开插件后再试。';apply.disabled=true;revoke.disabled=true;
}
