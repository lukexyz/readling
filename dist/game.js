import {dolphinFamilies,dolphinShots} from './dolphins.js';
import {flowerFamilies,flowerShots} from './gardens.js';
import {woodlandByKey,woodlandShots} from './woodland.js';
import {prismByFamily,prismShots} from './prism.js';
import {STAGES, ENTRIES, WORDS, TALES, CLASS_SOUNDS, unitsOf, soundsOf} from './catalogue.js';
import {SOUNDS} from './phonics.js';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const starterSounds=[...new Set(STAGES[0].entries.flatMap(e=>e.sounds))].sort().join('');
const KEY = 'readling.wordwoods.v1';
const DAY = 86400000;
const SOON = 2*60000;
const GAPS = [1,3,7,14,30];
// What she can add to her celebration show, in the order it is offered. Some wait for an earlier pick,
// for one of several picks, for a word in her album or for a number of finds.
const [poppies,moonflowers,sunflowers]=flowerFamilies.map(family=>family.shots);
const SHOW = [
  prismByFamily.rainbow[0],{id:'music',name:'Music'},
  {id:'stars',name:'More stars'},poppies[0],woodlandByKey.bunnies.shots[0],
  {id:'fountains',name:'Star fountains'},prismByFamily.rainbow2[0],
  prismByFamily.blooms[0],moonflowers[0],woodlandByKey.parade.shots[0],
  woodlandByKey.mushrooms.shots[0],dolphinShots[0],prismByFamily.paint[0],
  sunflowers[0],poppies[1],{id:'fireflies',name:'Fireflies'},woodlandByKey.vines.shots[0],
  woodlandByKey.elephants.shots[0],{id:'hats',name:'Hats',word:'hat',any:['bunnies','parade','elephants','whale',...dolphinFamilies.map(family=>family.levels[0].id)]},
  moonflowers[1],prismByFamily.picture[0],{id:'oak',name:'Oak tree'},sunflowers[1],
  {id:'whale',name:'Ember Orca · Level 1'},{id:'splash',name:'Big splash',after:'whale'},
  {id:'whale2',name:'Ember Orca · Level 2',after:'whale'},{id:'whale3',name:'Ember Orca · Level 3',after:'whale2'},
  poppies[2],moonflowers[2],sunflowers[2],...woodlandShots.filter(s=>s.level===2),
  ...dolphinShots.slice(1),...woodlandShots.filter(s=>s.level===3),
  ...prismShots.filter(s=>s.level===2),...prismShots.filter(s=>s.level===3)
];
const prismIds=key=>prismByFamily[key].map(s=>s.id);
const SHOW_GROUPS = [
  ['Rainbows & music',[...prismIds('rainbow'),...prismIds('rainbow2'),'music']],
  ['Sky',['stars','fountains',...prismIds('blooms'),...prismIds('paint')]],
  ['Flowers',flowerShots.map(shot=>shot.id)],
  ['Ground',[...woodlandByKey.mushrooms.shots,...woodlandByKey.vines.shots].map(s=>s.id).concat('oak')],
  ['Visitors',[...woodlandByKey.bunnies.shots,...woodlandByKey.parade.shots,...woodlandByKey.elephants.shots].map(s=>s.id)],
  ['Dolphins',dolphinShots.map(shot=>shot.id)],
  ['Big finishes',['fireflies',...prismIds('picture'),'whale','whale2','whale3','splash']],
  ['Extras',['hats']]
];
const isWord = w=>WORDS.includes(w);
const clamp = (n, min, max)=>Math.min(max, Math.max(min, n));
const num = (v, fallback=0)=>typeof v==='number' && Number.isFinite(v) ? v : fallback;
const tally = v=>clamp(Math.floor(num(v)),0,999999);
function inkForWord(raw, word) {
  return [...word].map((_, i) => {
    if (!Array.isArray(raw?.[i])) return [];
    return raw[i].slice(0,40).map(line => {
      if (!Array.isArray(line)) return [];
      return line.slice(0,900).filter(p=>Array.isArray(p) && p.length===2 && p.every(Number.isFinite))
        .map(([x,y])=>[clamp(Math.round(x*10)/10,0,180),clamp(Math.round(y*10)/10,0,138)]);
    }).filter(line=>line.length);
  });
}
function newProfile() {
  return {version:1, cards:{}, sounds:{}, stars:0, lesson:null, scene:[], show:{picks:[],tasks:0},
    settings:{voice:true, sparkles:true, fanfare:true, memoryFirst:true, sounds:[...CLASS_SOUNDS]}};
}
function normalise(raw) {
  const p=newProfile(), now=Date.now();
  if (raw?.version!==1) return p;
  // Albums saved before sounds were tracked kept one box and date per word.
  const tracked=raw.sounds && typeof raw.sounds==='object';
  for (const word of WORDS) {
    const card=raw.cards?.[word];
    if (!card || typeof card!=='object') continue;
    const box=clamp(Math.floor(num(card.box)),0,4);
    p.cards[word]={
      found:num(card.found,now), due:!tracked && box?0:num(card.due),
      reviews:tally(card.reviews), reviewed:num(card.reviewed),
      assisted:!!card.assisted, ink:inkForWord(card.ink,word)
    };
    for (const c of soundsOf(word)) {
      const s=tracked && raw.sounds[c], old=p.sounds[c], due=num(card.due,now);
      if (s && typeof s==='object') {
        p.sounds[c]={box:clamp(Math.floor(num(s.box)),0,4),due:num(s.due,now),right:tally(s.right),wrong:tally(s.wrong),seen:num(s.seen)};
      } else {
        // A sound shared by several old cards starts from its least practised word.
        p.sounds[c]=old?{...old,box:Math.min(old.box,box),due:Math.min(old.due,due)}:{box,due,right:0,wrong:0,seen:0};
      }
    }
  }
  p.stars=clamp(Math.floor(num(raw.stars)),Object.keys(p.cards).length*5,9999999);
  p.settings.voice=raw.settings?.voice!==false;
  p.settings.sparkles=raw.settings?.sparkles!==false;
  p.settings.fanfare=raw.settings?.fanfare!==false;
  p.settings.memoryFirst=raw.settings?.memoryFirst!==false;
  const selected=raw.settings?.sounds;
  // v1 stored single letters concatenated. An unchanged "all" follows the expanded
  // catalogue; a deliberately limited class keeps just the sounds it selected.
  if (Array.isArray(selected)) p.settings.sounds=CLASS_SOUNDS.filter(c=>selected.includes(c));
  else if(typeof selected==='string' && [...new Set(selected)].sort().join('')!==starterSounds)
    p.settings.sounds=CLASS_SOUNDS.filter(c=>c.length===1 && selected.includes(c));
  const l=raw.lesson;
  if(l && isWord(l.word)) {
    p.lesson={word:l.word,i:clamp(Math.floor(num(l.i)),0,l.word.length),ink:inkForWord(l.ink,l.word),help:!!l.help};
  }
  if (Array.isArray(raw.scene)) {
    p.scene=raw.scene.filter(s=>s && p.cards[s.word]).slice(-16)
      .map(s=>({word:s.word,x:clamp(num(s.x,50),8,92),y:clamp(num(s.y,50),12,88)}));
  }
  // An album saved before she could build her show counts each find as a finished task.
  const show=raw.show && typeof raw.show==='object'?raw.show:null;
  p.show.picks=SHOW.map(s=>s.id).filter(id=>Array.isArray(show?.picks) && show.picks.includes(id));
  p.show.tasks=show?tally(show.tasks):Object.keys(p.cards).length;
  return p;
}
export const BADGES_PER_STAGE=5;
function stageProgress(p) {
  let open=true;
  return STAGES.map(stage=>{
    const found=stage.core.filter(e=>p.cards[e.word]).length;
    // Opening the stage awards its first badge. The last one lands on its graduation word.
    const steps=BADGES_PER_STAGE-1;
    const badgeRank=open?1+Math.floor(Math.min(found,stage.goal)*steps/stage.goal):0;
    const nextBadgeAt=open && badgeRank<BADGES_PER_STAGE?Math.ceil(badgeRank*stage.goal/steps):null;
    const result={stage,open,found,badgeRank,nextBadgeAt};
    open=open && found>=stage.goal;
    return result;
  });
}
function availableWords(p, number) {
  const allowed=new Set(p.settings.sounds);
  return stageProgress(p).filter(s=>s.open && (!number || s.stage.number===number))
    .flatMap(s=>s.stage.entries.filter(e=>e.sounds.every(c=>allowed.has(c))).map(e=>e.word));
}
function findNext(p, number, bonusOnly=false) {
  // First offer the new collection when it opens. Earlier open pages still deal every remaining card.
  const available=availableWords(p,number).filter(w=>!p.cards[w]);
  const latest=ENTRIES.get(available.at(-1))?.stage;
  const page=available.filter(w=>ENTRIES.get(w).stage===latest);
  if(bonusOnly) return page.find(w=>ENTRIES.get(w).bonus);
  return page.find(w=>!ENTRIES.get(w).bonus) || page[0];
}
function getLevel(p) {return 1+Math.floor(Object.keys(p.cards).length/3);}
function startLesson(p,word) {
  if(!isWord(word) || (!p.cards[word] && !availableWords(p).includes(word))) return false;
  p.lesson={word,i:0,ink:[...word].map(()=>[]),help:false};
  return true;
}
function collect(p, now=Date.now()) {
  const l=p.lesson;
  if(!l || l.i!==l.word.length || !isWord(l.word)) return null;
  if(!p.cards[l.word] && !availableWords(p).includes(l.word)) return null;
  const before=stageProgress(p);
  const existing=p.cards[l.word];
  if(existing) {
    l.ink.forEach((lines,i)=>{if(lines.length) existing.ink[i]=lines;});
  } else {
    p.cards[l.word]={found:now,due:now+SOON,reviews:0,reviewed:0,assisted:l.help,ink:l.ink};
    for(const c of soundsOf(l.word)) p.sounds[c] ||= {box:0,due:now+SOON,right:0,wrong:0,seen:0};
    p.stars+=5;
    finishTask(p);
  }
  p.lesson=null;
  const after=stageProgress(p), i=after.findIndex(s=>s.stage.number===ENTRIES.get(l.word).stage);
  const unlocked=after.findLast((s,index)=>s.open && !before[index].open);
  return {word:l.word, fresh:!existing, levelUp:!existing && Object.keys(p.cards).length%3===0,
    badgeEarned:after[i].badgeRank>before[i].badgeRank?after[i].badgeRank:0, unlocked:unlocked?.stage.number ?? null};
}
// Memory matches a word to its picture, so it needs two finds. A new or missed word gets its own
// quick check. Each sound that is due then brings back the word with that sound that has rested longest,
// so a sound she slipped on returns in a second word as well as the one she missed.
function dueWords(p, now=Date.now()) {
  const found=WORDS.filter(w=>p.cards[w]);
  if(found.length<2) return [];
  const queue=found.filter(w=>p.cards[w].due && p.cards[w].due<=now).sort((a,b)=>p.cards[a].due-p.cards[b].due);
  const forSounds=[];
  const sounds=Object.keys(p.sounds).filter(c=>p.sounds[c].due<=now).sort((a,b)=>p.sounds[a].due-p.sounds[b].due);
  for(const c of sounds) {
    if(forSounds.some(w=>soundsOf(w).includes(c))) continue;
    const word=found.filter(w=>soundsOf(w).includes(c) && !queue.includes(w) && p.cards[w].due<=now)
      .sort((a,b)=>p.cards[a].reviewed-p.cards[b].reviewed)[0];
    if(word) {queue.push(word);forSounds.push(word);}
  }
  return queue;
}
function reviewQueue(p, now=Date.now()) {
  const due=dueWords(p,now);
  if(due.length) return due.slice(0,4);
  const found=WORDS.filter(w=>p.cards[w]);
  return found.length<2?[]:found.sort((a,b)=>p.cards[a].reviewed-p.cards[b].reviewed).slice(0,4);
}
// The other pictures come from her album. Words that start the same or share letters in place
// are chosen first, so the first letter alone cannot settle it.
function pictureChoices(p, word, random=Math.random) {
  const target=soundsOf(word);
  const alike=w=>(soundsOf(w)[0]===target[0]?2:0)+soundsOf(w).filter((c,i)=>c===target[i]).length+random()*.9;
  const picks=[word,...WORDS.filter(w=>w!==word && p.cards[w]).map(w=>[alike(w),w]).sort((a,b)=>b[0]-a[0]).slice(0,2).map(x=>x[1])];
  for(let j=picks.length-1;j>0;j--){const k=Math.floor(random()*(j+1));[picks[j],picks[k]]=[picks[k],picks[j]];}
  return picks;
}
// The first picture she taps decides the schedule. A wrong picture points at the sounds that differ,
// and so does asking the shelf for a sound. An unaided read lets each sound that was due rest longer.
// Align unequal-length answers so an extra sound does not mark every following sound as a slip.
function missedSounds(a,b) {
  const d=Array.from({length:a.length+1},(_,i)=>Array.from({length:b.length+1},(_,j)=>i+j));
  for(let i=1;i<=a.length;i++) for(let j=1;j<=b.length;j++)
    d[i][j]=Math.min(d[i-1][j-1]+Number(a[i-1]!==b[j-1]),d[i-1][j]+1,d[i][j-1]+1);
  const missed=[];
  for(let i=a.length,j=b.length;i||j;) {
    if(i && j && d[i][j]===d[i-1][j-1]+Number(a[i-1]!==b[j-1])) {
      if(a[i-1]!==b[j-1]) missed.push(a[i-1]);
      i--;j--;
    } else if(i && d[i][j]===d[i-1][j]+1) missed.push(a[--i]);
    else j--;
  }
  return missed;
}
function recordRead(p, word, {picked=word, asked=[], heard=false}={}, now=Date.now()) {
  const card=p.cards[word];
  if(!card) return false;
  const units=soundsOf(word), hints=typeof asked==='string'?[asked]:asked;
  const shaky=new Set([...hints.filter(c=>units.includes(c)),...missedSounds(units,soundsOf(picked))]);
  const unaided=picked===word && !shaky.size && !heard;
  for(const c of new Set(units)) {
    const s=p.sounds[c];
    if(!s) continue;
    if(shaky.has(c)) {s.box=0; s.due=now+SOON; s.wrong++; s.seen=now;}
    else if(unaided) {
      if(s.due<=now) {s.due=now+GAPS[s.box]*DAY; s.box=Math.min(4,s.box+1);}
      s.right++; s.seen=now;
    }
  }
  card.due=unaided?0:now+SOON;
  card.reviews++; card.reviewed=now; card.assisted=!unaided; p.stars++;
  return unaided;
}
// A new find and a finished memory round each count as a task. Her first task earns a choice of two things
// to add to her show, and every second task after that earns another.
function finishTask(p) {p.show.tasks=Math.min(999999,p.show.tasks+1);}
// The first two things in the list that she has not added and that are open to her.
// The one she leaves is offered again next time, beside something new.
function showChoices(p) {
  const has=id=>p.show.picks.includes(id), finds=Object.keys(p.cards).length;
  return SHOW.filter(s=>!has(s.id) && (!s.after || has(s.after)) && (!s.any || s.any.some(has)) &&
    (!s.word || p.cards[s.word]) && finds>=(s.finds || 0)).slice(0,2).map(s=>s.id);
}
function showDue(p) {return p.show.tasks>=1+2*p.show.picks.length && showChoices(p).length>0;}
function addToShow(p, id) {
  if(!showDue(p) || !showChoices(p).includes(id)) return false;
  p.show.picks=SHOW.map(s=>s.id).filter(x=>x===id || p.show.picks.includes(x));
  return true;
}
// Combines another copy of the album into this one, as when two tablets have both been played on.
// For each word and each sound, the copy that was used most recently wins.
function mergeAlbum(p, other) {
  const wasEmpty=!Object.keys(p.cards).length;
  for(const w of WORDS) {
    const theirs=other.cards[w], ours=p.cards[w];
    if(theirs && (!ours || Math.max(theirs.found,theirs.reviewed)>Math.max(ours.found,ours.reviewed))) p.cards[w]=theirs;
  }
  for(const c of CLASS_SOUNDS) {
    const theirs=other.sounds[c], ours=p.sounds[c];
    if(theirs && (!ours || theirs.seen>ours.seen)) p.sounds[c]=theirs;
  }
  p.stars=Math.max(p.stars,other.stars,Object.keys(p.cards).length*5);
  // Her show keeps everything added on either tablet.
  p.show.picks=SHOW.map(s=>s.id).filter(id=>p.show.picks.includes(id) || other.show.picks.includes(id));
  p.show.tasks=Math.max(p.show.tasks,other.show.tasks);
  // A tablet with no finds yet takes the other album's settings and scene, but keeps a word she has started.
  if(wasEmpty && Object.keys(other.cards).length) {p.settings=other.settings;p.scene=other.scene;p.lesson ||= other.lesson;}
  return p;
}
// The copy that is saved online. Loading it first puts the words and sounds in a set order, so two tablets
// holding the same album pack the same copy. It has to fit in one document, so heavy scribbles are thinned,
// a little more each pass, until it does.
function packAlbum(p, limit=900000) {
  const album=normalise(JSON.parse(JSON.stringify(p)));
  let json=JSON.stringify(album);
  for(let step=2;json.length>limit && step<=1024;step*=2) {
    json=JSON.stringify(album,(key,v)=>Array.isArray(v) && typeof v[0]?.[0]==='number'?v.filter((_,i)=>i%step===0 || i===v.length-1):v);
  }
  // With hundreds of very full cards, even two points per stroke can exceed the
  // cloud document. Keep sample strokes on each letter, leaving the local inks intact.
  for(let step=2;json.length>limit && step<=64;step*=2) {
    json=JSON.stringify(album,(key,v)=>key==='ink'?v.map(lines=>lines.filter((_,i)=>i%step===0)
      .map(line=>line.length>1?[line[0],line.at(-1)]:line)):v);
  }
  return json;
}
function swapPairs(p) {
  const found=Object.keys(p.cards);
  return found.flatMap((a,i)=>found.slice(i+1).filter(b=>{
    const aa=unitsOf(a),bb=unitsOf(b);
    return aa.length===bb.length && aa.filter((u,j)=>u.id!==bb[j].id || u.letters!==bb[j].letters).length===1 &&
      aa.some((u,j)=>SOUNDS[u.id].ipa!==SOUNDS[bb[j].id].ipa);
  }).map(b=>[a,b]));
}
function pathData(points) {
  if(!points.length) return '';
  const path='M'+points.map(p=>p.join(' ')).join(' L');
  return points.length===1?path+' l0.05 0':path;
}
export {WORDS, TALES, STAGES, ENTRIES, unitsOf, soundsOf, ALPHABET, CLASS_SOUNDS, KEY, DAY, SHOW, SHOW_GROUPS, clamp, newProfile, normalise, stageProgress, availableWords, findNext, getLevel, startLesson, collect, dueWords, reviewQueue, pictureChoices, recordRead, finishTask, showChoices, showDue, addToShow, mergeAlbum, packAlbum, swapPairs, pathData};
