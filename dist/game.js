import {dolphinFamilies,dolphinShots} from './dolphins.js';
import {flowerFamilies,flowerShots} from './gardens.js';
import {woodlandByKey,woodlandShots} from './woodland.js';
import {prismByFamily,prismShots} from './prism.js';

const WORDS = ['cat','hat','mat','dog','log','pot','sun','bug','cup','hen','pen','pig'];
const TALES = {
  cat:'A little cat curls up beside the path.',
  hat:'A hat for a very small head!',
  mat:'Just the spot for a catnap.',
  dog:'A friendly dog sniffs the woodland air.',
  log:'A little log makes a lovely seat.',
  pot:'Something smells good in this pot.',
  sun:'The sun peeks through the leaves.',
  bug:'A tiny bug sets off on a big adventure.',
  cup:'A warm cup after a woodland walk.',
  hen:'The hen has a secret hiding place.',
  pen:'A pen for drawing your next discovery.',
  pig:'A little pig finds a very muddy puddle.'
};
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const CLASS_SOUNDS = [...new Set(WORDS.join(''))].sort().join('');
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
  sunflowers[0],prismByFamily.slide[0],poppies[1],{id:'fireflies',name:'Fireflies'},woodlandByKey.vines.shots[0],
  woodlandByKey.elephants.shots[0],{id:'hats',name:'Hats',word:'hat',any:['bunnies','parade','elephants','whale',...dolphinFamilies.map(family=>family.levels[0].id)]},
  moonflowers[1],prismByFamily.picture[0],{id:'oak',name:'Oak tree'},sunflowers[1],
  {id:'whale',name:'Ember Orca · Level 1'},prismByFamily.ribbon[0],{id:'splash',name:'Big splash',after:'whale'},
  {id:'whale2',name:'Ember Orca · Level 2',after:'whale'},{id:'whale3',name:'Ember Orca · Level 3',after:'whale2'},
  poppies[2],moonflowers[2],sunflowers[2],...woodlandShots.filter(s=>s.level===2),
  ...dolphinShots.slice(1),...woodlandShots.filter(s=>s.level===3),
  ...prismShots.filter(s=>s.level===2),...prismShots.filter(s=>s.level===3)
];
const prismIds=key=>prismByFamily[key].map(s=>s.id);
const SHOW_GROUPS = [
  ['Rainbows & music',[...['rainbow','rainbow2','slide','ribbon'].flatMap(prismIds),'music']],
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
    settings:{voice:true, sparkles:true, fanfare:true, memoryFirst:true, sounds:CLASS_SOUNDS}};
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
    for (const c of word) {
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
  if (typeof raw.settings?.sounds==='string') {
    p.settings.sounds=[...CLASS_SOUNDS].filter(c=>raw.settings.sounds.includes(c)).join('');
  }
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
function availableWords(p) {return WORDS.filter(w=>[...w].every(c=>p.settings.sounds.includes(c)));}
function findNext(p) {return availableWords(p).find(w=>!p.cards[w]);}
function getLevel(p) {return 1+Math.floor(Object.keys(p.cards).length/3);}
function startLesson(p,word) {
  p.lesson={word,i:0,ink:[...word].map(()=>[]),help:false};
}
function collect(p, now=Date.now()) {
  const l=p.lesson;
  if(!l || l.i!==l.word.length) return null;
  const existing=p.cards[l.word];
  if(existing) {
    l.ink.forEach((lines,i)=>{if(lines.length) existing.ink[i]=lines;});
  } else {
    p.cards[l.word]={found:now,due:now+SOON,reviews:0,reviewed:0,assisted:l.help,ink:l.ink};
    for(const c of l.word) p.sounds[c] ||= {box:0,due:now+SOON,right:0,wrong:0,seen:0};
    p.stars+=5;
    finishTask(p);
  }
  p.lesson=null;
  return {word:l.word, fresh:!existing, levelUp:!existing && Object.keys(p.cards).length%3===0};
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
    if(forSounds.some(w=>w.includes(c))) continue;
    const word=found.filter(w=>w.includes(c) && !queue.includes(w) && p.cards[w].due<=now)
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
  const alike=w=>(w[0]===word[0]?2:0)+[...w].filter((c,i)=>c===word[i]).length+random()*.9;
  const picks=[word,...WORDS.filter(w=>w!==word && p.cards[w]).map(w=>[alike(w),w]).sort((a,b)=>b[0]-a[0]).slice(0,2).map(x=>x[1])];
  for(let j=picks.length-1;j>0;j--){const k=Math.floor(random()*(j+1));[picks[j],picks[k]]=[picks[k],picks[j]];}
  return picks;
}
// The first picture she taps decides the schedule. A wrong picture points at the sounds that differ,
// and so does asking the shelf for a sound. An unaided read lets each sound that was due rest longer.
function recordRead(p, word, {picked=word, asked='', heard=false}={}, now=Date.now()) {
  const card=p.cards[word];
  if(!card) return false;
  const shaky=new Set([...asked,...[...word].filter((c,i)=>c!==picked[i])]);
  const unaided=!shaky.size && !heard;
  for(const c of new Set(word)) {
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
  for(let step=2;json.length>limit && step<=32;step*=2) {
    json=JSON.stringify(album,(key,v)=>Array.isArray(v) && typeof v[0]?.[0]==='number'?v.filter((_,i)=>i%step===0 || i===v.length-1):v);
  }
  return json;
}
function swapPairs(p) {
  return WORDS.flatMap((a,i)=>WORDS.slice(i+1).filter(b=>p.cards[a] && p.cards[b] &&
    [...a].filter((c,j)=>c!==b[j]).length===1).map(b=>[a,b]));
}
function pathData(points) {
  if(!points.length) return '';
  const path='M'+points.map(p=>p.join(' ')).join(' L');
  return points.length===1?path+' l0.05 0':path;
}
export {WORDS, TALES, ALPHABET, CLASS_SOUNDS, KEY, DAY, SHOW, SHOW_GROUPS, clamp, newProfile, normalise, availableWords, findNext, getLevel, startLesson, collect, dueWords, reviewQueue, pictureChoices, recordRead, finishTask, showChoices, showDue, addToShow, mergeAlbum, packAlbum, swapPairs, pathData};
