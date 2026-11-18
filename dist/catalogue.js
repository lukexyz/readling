import {parse} from './vendor/toml.js';
import {readSpelling} from './phonics.js';

export function parseCatalogue(source) {
  const {stages}=parse(source), byWord=new Map(), numbers=new Set();
  if(!Array.isArray(stages) || !stages.length) throw Error('The catalogue needs numbered stages.');
  const ordered=stages.slice().sort((a,b)=>a.number-b.number).map(({number,name,words})=>{
    if(!Number.isSafeInteger(number) || number<1 || numbers.has(number)) throw Error('Invalid or repeated stage '+number);
    numbers.add(number);
    if(!Array.isArray(words) || !words.length) throw Error('Empty stage '+number);
    const entries=words.map(raw=>{
      const {word,difficulty='normal',tags=[],theme,word_type,bonus=false,reading,tale}=raw;
      if(typeof word!=='string' || !/^[a-z]+$/.test(word) || word in Object.prototype || byWord.has(word)) throw Error('Invalid or duplicate word: '+word);
      if(typeof difficulty!=='string' || !Array.isArray(tags) || tags.some(t=>typeof t!=='string') ||
         typeof bonus!=='boolean' || [theme,word_type,tale].some(t=>t!==undefined && typeof t!=='string')) throw Error('Invalid metadata for '+word);
      const units=readSpelling(word,reading);
      const entry={word,stage:number,difficulty,tags,theme,word_type,bonus,tale,units,sounds:units.map(u=>u.id)};
      byWord.set(word,entry);
      return entry;
    });
    const core=entries.filter(e=>!e.bonus);
    if(!core.length) throw Error('Stage '+number+' needs a core word');
    return {number,name:typeof name==='string'?name:'Collection '+number,entries,core,
      goal:number===1?core.length:Math.min(8,core.length)};
  });
  if(ordered[0].number!==1) throw Error('The first collection must be stage 1');
  return {stages:ordered,byWord};
}
const url=new URL('./words.toml',import.meta.url);
async function readSource() {
  if(url.protocol==='file:') return (await import('node:fs/promises')).readFile(url,'utf8');
  const response=await fetch(url);
  if(!response.ok) throw Error('Could not open the word catalogue ('+response.status+')');
  return response.text();
}
export const {stages:STAGES,byWord:ENTRIES}=parseCatalogue(await readSource());
export const WORDS=[...ENTRIES.keys()];
export const unitsOf=word=>ENTRIES.get(word)?.units || [];
export const soundsOf=word=>ENTRIES.get(word)?.sounds || [];
export const TALES=Object.fromEntries([...ENTRIES.values()].filter(e=>e.tale).map(e=>[e.word,e.tale]));
export const CLASS_SOUNDS=[...new Set(WORDS.flatMap(soundsOf))].sort();
