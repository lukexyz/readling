// Populate and verify the immutable WebP objects of this exact published build.
// Supply the short-lived release grant on stdin. Only its SHA-256 verifier is built into the Worker.
import {createHash} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import {createInterface} from 'node:readline/promises';

const origin='https://readling-word-woods.skuxnet.chatgpt.site';
const base=new URL('../dist/assets/',import.meta.url);
if (process.stdin.isTTY) process.stdin.setRawMode(true);
const input=createInterface({input:process.stdin,terminal:false});
console.log('Ready for release grant on stdin.');
const grant=(await input.question('')).trim();
input.close();
if (process.stdin.isTTY) process.stdin.setRawMode(false);
if (!/^[a-f0-9]{64}$/.test(grant)) throw Error('Invalid release grant');
const images=[];
for (const folder of ['dolphins','ember-orca','flower-studies','woodland']) {
  let names;
  try {names=await readdir(new URL(folder+'/',base));}
  catch (err) {if(err.code==='ENOENT') continue;throw err;}
  for (const name of names.filter(n=>n.endsWith('.webp'))) images.push(folder+'/'+name);
}
let next=0;
async function verify(file) {
  const url=origin+'/assets/'+file;
  const body=await readFile(new URL(file,base));
  const sha=data=>createHash('sha256').update(data).digest('hex');
  const hash=sha(body);
  const head=await fetch(url,{method:'HEAD',redirect:'error'});
  if (!head.ok || head.headers.get('etag')!=='"'+hash+'"') {
    const put=await fetch(url,{method:'PUT',redirect:'error',headers:{'X-Readling-Release':grant,'Content-Type':'image/webp'},body});
    if (!put.ok) throw Error(file+' upload returned '+put.status);
  }
  const check=await fetch(url,{redirect:'error',cache:'no-store'});
  if (!check.ok || sha(Buffer.from(await check.arrayBuffer()))!==hash) throw Error(file+' failed live verification');
}
async function worker() {
  while (next<images.length) {
    const file=images[next++];
    for (let attempt=1;;attempt++) {
      try {await verify(file);break;}
      catch(error) {if(attempt===4) throw error;await new Promise(r=>setTimeout(r,attempt*900));}
    }
  }
}
await Promise.all(Array.from({length:4},worker));
console.log('Verified '+images.length+' live WebP files by SHA-256.');
