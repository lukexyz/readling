import {mkdir,open,readFile,rename,stat,unlink,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {STAGES,TALES} from '../dist/catalogue.js';
import {PROMPTS,VOICE_ID} from '../dist/voice-lines.js';
// Only this local publishing script talks to ElevenLabs. The public Site serves files.
const root=fileURLToPath(new URL('../',import.meta.url));
const audioDir=join(root,'dist','assets','audio','narrator');
const output=join(audioDir,VOICE_ID);
const rawDir=join(root,'scripts','.voice-cache-raw',VOICE_ID);
const args=process.argv.slice(2);
const verify=args.length===1 && args[0]==='--check';
if(args.length && !verify && !(args.length===2 && args[0]==='--key-file')) throw Error('Use --check or --key-file <local file>.');
const lines={...PROMPTS};
// The starter collection uses the original narrator. Later words already have
// human recordings; publishing that library must never buy hundreds of new takes.
for(const {word} of STAGES[0].entries){lines['word-'+word]=word;if(TALES[word])lines['tale-'+word]=TALES[word];}
const settings={model_id:'eleven_multilingual_v2',language_code:'en',voice_settings:{stability:.6,similarity_boost:.8,speed:.9}};
const format='mp3_44100_128';
const files={};
let generated=0, cached=0, key;
// Match the existing speech and music without compressing the articulation of a short word.
function mixVoice(source,destination){
  const run=(args)=>{
    const p=spawnSync('ffmpeg',['-nostdin','-hide_banner','-nostats',...args],{encoding:'utf8',windowsHide:true,timeout:30000});
    if(p.error || p.status!==0) throw Error('FFmpeg must be available locally to prepare the narration.');
    return p.stderr;
  };
  const report=run(['-i',source,'-af','loudnorm=I=-19:TP=-2:LRA=9:print_format=json','-f','null','-']);
  const match=report.match(/\{\s*"input_i"[\s\S]*?\}/);
  if(!match) throw Error('Cannot measure the narration volume.');
  const m=JSON.parse(match[0]), loudness=Number(m.input_i), peak=Number(m.input_tp);
  if(!Number.isFinite(peak)) throw Error('The narration contains no measurable audio.');
  // Very short clips cannot be measured in LUFS; match those by peak instead.
  const gain=Math.min(-2-peak,Number.isFinite(loudness)?-19-loudness:Infinity);
  run(['-y','-i',source,'-map','0:a:0','-map_metadata','-1','-af','volume='+gain.toFixed(2)+'dB',
    '-c:a','libmp3lame','-b:a','128k','-ar','44100','-f','mp3',destination]);
}
await mkdir(output,{recursive:true});
for(const [id,text] of Object.entries(lines)){
  const body={text,...settings};
  if(id.startsWith('word-')) body.previous_text='Listen to this word.';
  const hash=createHash('sha256').update(JSON.stringify([VOICE_ID,format,body])).digest('hex').slice(0,14);
  const filename=id+'.'+hash+'.mix1.mp3';
  const destination=join(output,filename);
  files[id]='./assets/audio/narrator/'+VOICE_ID+'/'+filename;
  if(existsSync(destination) && (await stat(destination)).size>256){cached++;continue;}
  if(verify) throw Error('Missing recording: '+id);
  await mkdir(rawDir,{recursive:true});
  const raw=join(rawDir,id+'.'+hash+'.mp3');
  const rawTemp=join(rawDir,hash+'.'+process.pid+'.part');
  const mixedTemp=join(root,'scripts','.voice-cache-mix-'+hash+'-'+process.pid);
  const lock=join(root,'scripts','.voice-cache-'+hash+'.lock');
  // A failed publisher can resume from completed files. Two publishers cannot buy the same clip together.
  let handle;
  try {
    try {handle=await open(lock,'wx');}
    catch(error){
      if(error.code!=='EEXIST') throw error;
      const age=Date.now()-(await stat(lock)).mtimeMs;
      if(age<120000) throw Error('Another publisher is generating '+id+'. Try again after it finishes.');
      await unlink(lock);handle=await open(lock,'wx');
    }
    if(existsSync(destination) && (await stat(destination)).size>256){cached++;continue;}
    if(!existsSync(raw)){
      key??=(args[0]==='--key-file'?(await readFile(args[1],'utf8')).trim():process.env.ELEVENLABS_API_KEY?.trim());
      if(!key) throw Error('Set ELEVENLABS_API_KEY locally or pass --key-file <path> to generate '+id+'.');
      const response=await fetch('https://api.elevenlabs.io/v1/text-to-speech/'+VOICE_ID+'?output_format='+format,{
        method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json',Accept:'audio/mpeg'},
        body:JSON.stringify(body),signal:AbortSignal.timeout(45000)
      });
      if(!response.ok){
        const data=await response.json().catch(()=>({}));
        const reason=data?.detail?.status;
        throw Error('ElevenLabs returned '+response.status+' for '+id+(typeof reason==='string' && /^[a-z_]+$/.test(reason)?' ('+reason+')':''));
      }
      const bytes=new Uint8Array(await response.arrayBuffer());
      if(!response.headers.get('Content-Type')?.startsWith('audio/') || bytes.length<256) throw Error('Invalid MP3 for '+id);
      // Save the paid response before mixing, so a failed local step never buys the clip again.
      await writeFile(rawTemp,bytes);await rename(rawTemp,raw);generated++;
    } else cached++;
    mixVoice(raw,mixedTemp);await rename(mixedTemp,destination);
    console.log('Prepared '+id);
  } finally {
    await unlink(rawTemp).catch(()=>{});await unlink(mixedTemp).catch(()=>{});
    if(handle){await handle.close();await unlink(lock).catch(()=>{});}
  }
}
const index=join(audioDir,'catalogue.js');
const source='export const voiceFiles = '+JSON.stringify(files,null,2)+';\n';
if(verify){
  if((await readFile(index,'utf8')).replace(/\r\n/g,'\n')!==source) throw Error('The audio catalogue needs updating.');
} else {
  const temporary=join(root,'scripts','.voice-cache-catalogue-'+process.pid);
  await writeFile(temporary,source);await rename(temporary,index);
}
console.log(`${cached} reused, ${generated} generated. ${Object.keys(files).length} public MP3s ready.`);
