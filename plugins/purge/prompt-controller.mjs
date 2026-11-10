export const CLOUD_ROLE='skivu-host-cloud-v1';
export const LEGACY_SETTING='prompt-injection.enabled.v1';
const ROLE_SETTING='prompt-injection.role.v2.';
const validRole=role=>typeof role==='string'&&role.length>0&&role.length<=200&&!role.includes('\0');

export async function roleSettingKey(role){
 if(!validRole(role))throw Error('INVALID_ROLE');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(role));
 return ROLE_SETTING+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}

export function createPromptController(call,expected,onChange=()=>{}){
 let state={phase:'checking',busy:false,roleId:null},busy=false,epoch=0,boundRole=null,refreshQueued=false;
 const emit=(phase,detail='')=>{
  state={phase,detail,busy,roleId:boundRole};
  onChange({...state});
  return {...state};
 };
 async function work(action){
  if(busy)return {...state};
  busy=true;
  const ticket=++epoch;
  emit(action==='revoke'?'revoking':'checking');
  try{
   const context=await call('context.get',{});
   if(ticket!==epoch)return {...state};
   const role=context?.roleId;
   boundRole=validRole(role)?role:null;
   if(!boundRole)return emit('no_role','请先在上方选择角色。');
   const key=await roleSettingKey(role);
   if(ticket!==epoch)return {...state};
   let enabled=await call('storage.get',{key});
   if(ticket!==epoch)return {...state};
   if(action==='apply'||action==='revoke'){
    enabled=action==='apply';
    if(await call('storage.set',{key,value:enabled})!==true)throw Error('PREFERENCE_NOT_SAVED');
   }else if(typeof enabled!=='boolean'&&role===CLOUD_ROLE){
    // The former global preference belonged only to 小云.
    enabled=await call('storage.get',{key:LEGACY_SETTING})!==false;
    if(ticket!==epoch)return {...state};
    if(await call('storage.set',{key,value:enabled})!==true)throw Error('PREFERENCE_NOT_SAVED');
   }
   if(ticket!==epoch)return {...state};
   const prior=await call('prompt.get',{});
   if(ticket!==epoch)return {...state};
   if(prior?.roleId!==role)return emit('unconfirmed','上下文已变化，请重新核验。');
   // Visiting an unconfigured role must not write or erase its contribution.
   if(typeof enabled!=='boolean'&&prior.text!==expected){
    return emit('inactive','当前角色尚未注入，点击下方按钮即可单独启用。');
   }
   const wanted=enabled===false?'':expected;
   if(prior.text!==wanted){
    const current=await call('context.get',{});
    if(ticket!==epoch)return {...state};
    if(current?.roleId!==role)return emit('unconfirmed','上下文已变化，请重新核验。');
    emit(wanted?'injecting':'revoking');
    if(await call('prompt.set',{text:wanted})!==true)throw Error('WRITE_NOT_CONFIRMED');
   }
   if(ticket!==epoch)return {...state};
   // Success always requires an exact readback for the same selected role.
   const saved=await call('prompt.get',{}),current=await call('context.get',{});
   if(ticket!==epoch)return {...state};
   if(saved?.roleId!==role||current?.roleId!==role||saved.text!==wanted){
    return emit('unconfirmed','宿主保存结果未通过当前角色核验。');
   }
   return wanted
    ?emit('verified','已读回核验当前角色后续对话的提示词配置。')
    :emit('inactive','已读回确认撤销，仅影响当前角色。');
  }catch{
   // Host errors and prompt contents never enter the visible state.
   if(ticket===epoch)return emit('unconfirmed','未能确认注入结果，请重试。');
   return {...state};
  }finally{
   busy=false;
   if(refreshQueued){
    refreshQueued=false;
    await work('start');
   }else{
    state={...state,busy:false};
    onChange({...state});
   }
  }
 }
 return{
  start:()=>work('start'),
  apply:()=>work('apply'),
  revoke:()=>work('revoke'),
  snapshot:()=>({...state}),
  contextChanged(context){
   const role=validRole(context?.roleId)?context.roleId:null;
   if(role&&role===boundRole)return Promise.resolve({...state});
   if(busy){
    epoch++;
    boundRole=role;
    refreshQueued=true;
    emit('checking','正在核验所选角色…');
    return Promise.resolve({...state});
   }
   return work('start');
  },
 };
}
