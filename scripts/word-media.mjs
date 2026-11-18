import {readFile} from 'node:fs/promises';
import {STAGES,WORDS,unitsOf} from '../dist/catalogue.js';
import {CLIPS} from '../dist/audio-library.js';

const root=new URL('../dist/',import.meta.url);
export const laterPictures=new Set(STAGES.slice(1).flatMap(s=>s.entries.map(e=>'assets/words/'+e.word+'.webp')));

export async function checkWordMedia() {
  const cues=JSON.parse(await readFile(new URL('assets/audio/blends/cues.json',root)));
  for(const word of WORDS) {
    const points=cues[word];
    if(!Array.isArray(points) || points.length!==unitsOf(word).length-1 ||
       !points.every((n,i)=>Number.isFinite(n) && n>(points[i-1] || 0))) throw Error('Invalid blend timings for '+word);
    const picture=await readFile(new URL('assets/words/'+word+'.webp',root));
    if(picture.toString('ascii',0,4)!=='RIFF' || picture.toString('ascii',8,12)!=='WEBP') throw Error('Invalid picture for '+word);
  }
  for(const clip of CLIPS) {
    const bytes=await readFile(new URL(clip.path.slice(1),root));
    if(bytes.length<256 || !(bytes.toString('ascii',0,3)==='ID3' || (bytes[0]===255 && (bytes[1]&224)===224)))
      throw Error('Invalid MP3 for '+clip.id);
  }
  return cues;
}
