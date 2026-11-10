import {createPromptController,CLOUD_ROLE,LEGACY_SETTING,roleSettingKey} from '../prompt-controller.mjs';

export const secret='Offline original fixture α — never render this text.';
export const tick=()=>new Promise(setImmediate);
export async function until(predicate){
 for(let i=0;i<100;i++){
  if(predicate())return;
  await new Promise(resolve=>setTimeout(resolve,1));
 }
 throw Error('Fixture did not reach the expected checkpoint');
}
export function fixture(options={}){
 let role=Object.hasOwn(options,'role')?options.role:CLOUD_ROLE,writes=0,lastPreference=options.enabled;
 const texts=new Map(Object.entries(options.texts??{}));
 const settings=new Map(Object.entries(options.settings??{}));
 if(options.text!==undefined)texts.set(role,options.text);
 if(options.enabled!==undefined)settings.set(LEGACY_SETTING,options.enabled);
 const seen=[],writtenRoles=[];
 const call=async(method,p)=>{
  if(method==='context.get')return {roleId:role};
  if(method==='storage.get')return settings.get(p.key);
  if(method==='storage.set'){settings.set(p.key,p.value);lastPreference=p.value;return true;}
  if(method==='prompt.get')return {roleId:role,text:texts.get(role)??''};
  if(method==='prompt.set'){writes++;writtenRoles.push(role);texts.set(role,p.text);return true;}
  throw Error('Unexpected method');
 };
 return {
  call,seen,texts,settings,writtenRoles,
  get writes(){return writes;},
  get text(){return texts.get(role)??'';},
  get enabled(){return lastPreference;},
  get role(){return role;},
  set role(value){role=value;},
  async enabledFor(id){return settings.get(await roleSettingKey(id));},
  controller(override=call){return createPromptController(override,secret,state=>seen.push(state));},
 };
}
