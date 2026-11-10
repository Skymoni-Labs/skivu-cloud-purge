export const CLOUD_ROLE='skivu-host-cloud-v1';
const SETTING='prompt-injection.enabled.v1';
export function createPromptController(call,expected,onChange=()=>{}){
 let state={phase:'checking',busy:false},busy=false,epoch=0,boundRole=null;
 const emit=(phase,detail='')=>{state={phase,detail,busy};onChange({...state});return {...state};};
 async function work(action){
  if(busy)return {...state};
  busy=true;const ticket=++epoch;emit(action==='revoke'?'revoking':'checking');
  try{
   const context=await call('context.get',{});
   boundRole=context?.roleId??null;
   if(ticket!==epoch)return {...state};
   if(context?.roleId!==CLOUD_ROLE)return emit('wrong_role','请在上方选择小云。');
   let enabled;
   if(action==='apply'||action==='revoke'){
    enabled=action==='apply';
    if(await call('storage.set',{key:SETTING,value:enabled})!==true)throw Error('PREFERENCE_NOT_SAVED');
   }else enabled=await call('storage.get',{key:SETTING})!==false;
   if(ticket!==epoch)return {...state};
   const prior=await call('prompt.get',{});
   if(ticket!==epoch)return {...state};
   if(prior?.roleId!==CLOUD_ROLE)return emit('unconfirmed','上下文已变化，请重新核验。');
   const wanted=enabled?expected:'';
   if(prior.text!==wanted){
    emit(enabled?'injecting':'revoking');
    if(await call('prompt.set',{text:wanted})!==true)throw Error('WRITE_NOT_CONFIRMED');
   }
   if(ticket!==epoch)return {...state};
   // A write acknowledgement alone does not prove the configuration was saved.
   const saved=await call('prompt.get',{}),current=await call('context.get',{});
   if(ticket!==epoch)return {...state};
   if(saved?.roleId!==CLOUD_ROLE||current?.roleId!==CLOUD_ROLE||saved.text!==wanted)return emit('unconfirmed','宿主保存结果未通过核验。');
   return enabled?emit('verified','已读回核验小云后续对话的提示词配置。'):emit('inactive','已读回确认撤销。');
  }catch{
   // Host errors may contain user data; never render or log them.
   if(ticket===epoch)return emit('unconfirmed','未能确认注入结果，请重试。');
   return {...state};
  }finally{busy=false;state={...state,busy:false};onChange({...state});}
 }
 return{start:()=>work('start'),apply:()=>work('apply'),revoke:()=>work('revoke'),snapshot:()=>({...state}),contextChanged(context){if(context?.roleId&&context.roleId===boundRole)return Promise.resolve({...state});if(busy){epoch++;emit('unconfirmed','上下文已变化，请重新核验。');return Promise.resolve({...state});}return work('start');}};
}
