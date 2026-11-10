import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const python=process.env.FEATURED_PYTHON||(process.platform==='win32'?'python':'python3');
const assets=JSON.parse(execFileSync(python,[path.join(root,'scripts/optimize-featured.py'),'--stdout'],{encoding:'utf8',windowsHide:true}));
for(const asset of assets){
 if(!/^(newsdesk|antou-v32)-(160|320)\.webp$/.test(asset.name))throw Error('Unexpected thumbnail name');
 const data=Buffer.from(asset.data,'base64');writeFileSync(path.join(root,'site/assets/img/optimized',asset.name),data);
 console.log(asset.name+': '+data.length+' bytes');
}
