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
const isWord = w=>WORDS.includes(w);
const clamp = (n, min, max)=>Math.min(max, Math.max(min, n));
const num = (v, fallback=0)=>typeof v==='number' && Number.isFinite(v) ? v : fallback;
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
  return {version:1, cards:{}, stars:0, lesson:null, scene:[], settings:{voice:true, sparkles:true, sounds:CLASS_SOUNDS}};
}
function normalise(raw) {
  const p=newProfile();
  if (raw?.version!==1) return p;
  for (const word of WORDS) {
    const card=raw.cards?.[word];
    if (!card || typeof card!=='object') continue;
    p.cards[word]={
      found:num(card.found,Date.now()), due:num(card.due, Date.now()), box:clamp(Math.floor(num(card.box)),0,4),
      reviews:clamp(Math.floor(num(card.reviews)),0,999999), reviewed:num(card.reviewed),
      assisted:!!card.assisted, ink:inkForWord(card.ink,word)
    };
  }
  p.stars=clamp(Math.floor(num(raw.stars)),Object.keys(p.cards).length*5,9999999);
  p.settings.voice=raw.settings?.voice!==false;
  p.settings.sparkles=raw.settings?.sparkles!==false;
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
    p.cards[l.word]={found:now,due:now+2*60000,box:0,reviews:0,reviewed:0,assisted:l.help,ink:l.ink};
    p.stars+=5;
  }
  p.lesson=null;
  return {word:l.word, fresh:!existing, levelUp:!existing && Object.keys(p.cards).length%3===0};
}
function reviewQueue(p, now=Date.now()) {
  const sorted=WORDS.filter(w=>p.cards[w]).sort((a,b)=>p.cards[a].due-p.cards[b].due);
  const due=sorted.filter(w=>p.cards[w].due<=now);
  return (due.length?due:sorted).slice(0,4);
}
function reviewCard(p,word,help,now=Date.now()) {
  const c=p.cards[word];
  if(!c) return;
  // An early replay can bring a difficult word back sooner; an easy replay keeps its original date.
  if(help) {
    c.box=0; c.due=now+2*60000;
  } else if(c.due<=now) {
    c.due=now+[1,3,7,14,30][c.box]*DAY;
    c.box=Math.min(4,c.box+1);
  }
  c.reviews++; c.reviewed=now; c.assisted=!!help; p.stars++;
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
export {WORDS, TALES, ALPHABET, CLASS_SOUNDS, KEY, clamp, newProfile, normalise, availableWords, findNext, getLevel, startLesson, collect, reviewQueue, reviewCard, swapPairs, pathData};
