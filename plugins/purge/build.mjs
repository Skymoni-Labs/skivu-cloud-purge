import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Decode only the original slot as data, without loading DSH host modules.
const provenance=JSON.parse(fs.readFileSync('PROVENANCE.json','utf8'));
for(const item of provenance.promptSourceFiles){
 const file=path.resolve('upstream',item.path);
 if(!file.startsWith(path.resolve('upstream')+path.sep)||crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==item.sha256)throw Error('Original prompt source hash mismatch');
}
const {openSlot}=await import('./upstream/lib/table-read.js');
const prompt=openSlot();
if(!prompt.trim())throw Error('Original prompt slot could not be decoded');
const bytes=Buffer.from(prompt,'utf8'),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
fs.mkdirSync('dist',{recursive:true});
fs.writeFileSync('dist/payload.mjs',`export const encoded=${JSON.stringify(bytes.toString('base64'))};\nexport const bytes=${bytes.length};\nexport const sha256=${JSON.stringify(sha256)};\n`);
for(const name of ['index.html','app.mjs','prompt-controller.mjs'])fs.copyFileSync(name,'dist/'+name);
const manifest={schemaVersion:1,apiVersion:'1.0',id:'org.skivu.purge',name:'小云 · 提示词注入',version:'1.1.1',minHostVersion:'0.2.96',author:'Skivu',description:'仅向小云注入原包提示词，并读回核验保存结果。页面不展示提示词正文，可随时撤销。',license:'MIT',source:'https://github.com/skyjjgw/skivu-cloud-purge',entry:'index.html',permissions:['prompt','storage'],networkDomains:[],contributes:{launcher:true,chatActions:[]}};
const files={};for(const name of ['index.html','app.mjs','prompt-controller.mjs','payload.mjs'])files[name]={mime:name.endsWith('.html')?'text/html':'application/javascript',base64:fs.readFileSync('dist/'+name).toString('base64')};
const value={manifest,files,licenseText:fs.readFileSync('upstream/LICENSE','utf8'),notices:'基于 YuJunZhiXue/dsh-purge 1.1.71，Copyright (c) 2026 小杨。原包提示词按原文提取，不展示于插件页面；仅保留提示词注入及其开关状态，不包含演练、技能、资料库、报告或独立 DSH 运行器。原作者署名、LICENSE 和 README 附加使用说明保留在源码 upstream/；免费分发。来源 https://github.com/YuJunZhiXue/dsh-purge'};
const raw=JSON.stringify(value);fs.writeFileSync('dist/skivu-purge-1.1.1.skivu.json',raw);
fs.writeFileSync('dist/prompt-proof.json',JSON.stringify({originalPromptBytes:bytes.length,originalPromptSha256:sha256,promptBodyDisplayed:false,resources:Object.keys(files),permissions:manifest.permissions},null,2));
console.log(JSON.stringify({version:manifest.version,originalPromptBytes:bytes.length,originalPromptSha256:sha256,packageBytes:Buffer.byteLength(raw),resources:Object.keys(files).length}));
