import test from 'node:test';
import assert from 'node:assert/strict';
import {STAGES,DAY,newProfile,normalise,startLesson,collect,dueWords,reviewQueue,pictureChoices,recordRead} from '../dist/game.js';
const WORDS=STAGES[0].entries.map(e=>e.word);
// Checks for the memory schedule in dist/game.js. They use words from the first collection,
// so they need updating if those words change.
const MIN=60000, START=1e12;
function find(p,word,now) {
  startLesson(p,word);p.lesson.i=word.length;
  return collect(p,now);
}
// An album where each word was found at START and read unaided three minutes later.
function album(words) {
  const p=newProfile();
  for(const w of words) find(p,w,START);
  for(const w of words) recordRead(p,w,{},START+3*MIN);
  return p;
}

test('memory needs two finds', () => {
  const p=newProfile();
  find(p,'cat',START);
  assert.deepEqual(Object.keys(p.sounds).sort(),['a','c','t']);
  assert.deepEqual(dueWords(p,START+DAY),[]);
  assert.deepEqual(reviewQueue(p,START+DAY),[]);
});

test('a new word is due after two minutes, and a word found moments ago waits its turn', () => {
  const p=newProfile();
  find(p,'cat',START);
  find(p,'hat',START+3*MIN);
  assert.equal(p.sounds.a.due,START+2*MIN,'a sound she already has keeps its date');
  assert.deepEqual(dueWords(p,START+3*MIN),['cat']);
  assert.deepEqual(dueWords(p,START+6*MIN),['cat','hat']);
});

test('an unaided read rests each due sound for a day and clears the quick check', () => {
  const p=newProfile(), now=START+3*MIN;
  find(p,'cat',START);find(p,'hat',START);
  const stars=p.stars;
  assert.equal(recordRead(p,'cat',{},now),true);
  assert.equal(p.cards.cat.due,0);
  assert.equal(p.cards.cat.assisted,false);
  assert.equal(p.stars,stars+1);
  for(const c of 'cat') assert.deepEqual(p.sounds[c],{box:1,due:now+DAY,right:1,wrong:0,seen:now});
  assert.equal(p.sounds.h.box,0);
  assert.deepEqual(dueWords(p,now),['hat']);
});

test('a sound that is not due keeps its date', () => {
  const p=newProfile(), now=START+3*MIN;
  find(p,'cat',START);find(p,'hat',START);
  recordRead(p,'cat',{},now);
  recordRead(p,'hat',{},now+MIN);
  assert.deepEqual(p.sounds.h,{box:1,due:now+MIN+DAY,right:1,wrong:0,seen:now+MIN});
  assert.deepEqual(p.sounds.a,{box:1,due:now+DAY,right:2,wrong:0,seen:now+MIN});
  assert.deepEqual(dueWords(p,now+MIN),[]);
});

test('a wrong picture marks only the sounds that differ', () => {
  const p=album(['cat','hat','mat','cup']), now=START+DAY+10*MIN;
  const c={...p.sounds.c};
  assert.equal(recordRead(p,'cat',{picked:'cup'},now),false);
  assert.deepEqual(p.sounds.c,c);
  for(const s of 'at') assert.deepEqual(p.sounds[s],{box:0,due:now+2*MIN,right:p.sounds[s].right,wrong:1,seen:now});
  assert.equal(p.cards.cat.due,now+2*MIN);
  assert.equal(p.cards.cat.assisted,true);
});

test('a slip brings back the missed word and a second word with those sounds', () => {
  const p=album(['cat','hat','mat','cup']), now=START+DAY+10*MIN;
  for(const w of ['hat','mat','cup']) recordRead(p,w,{},now);
  assert.deepEqual(dueWords(p,now),[]);
  recordRead(p,'cat',{picked:'cup'},now);
  assert.deepEqual(dueWords(p,now+MIN),[],'nothing returns before two minutes');
  assert.deepEqual(dueWords(p,now+3*MIN),['cat','hat']);
});

test('asking the shelf marks that sound, and hearing the word marks none', () => {
  const p=album(['dog','log']), now=START+DAY+10*MIN;
  recordRead(p,'dog',{asked:'g'},now);
  assert.equal(p.sounds.g.box,0);assert.equal(p.sounds.g.wrong,1);
  assert.equal(p.sounds.d.box,1);assert.equal(p.sounds.o.box,1);
  assert.equal(p.cards.dog.due,now+2*MIN);
  const l={...p.sounds.l};
  assert.equal(recordRead(p,'log',{heard:true},now),false);
  assert.deepEqual(p.sounds.l,l);
  assert.equal(p.cards.log.due,now+2*MIN);
});

test('the gaps grow to 1, 3, 7, 14 and 30 days', () => {
  const p=newProfile(), gaps=[];
  find(p,'sun',START);find(p,'pig',START);
  let now=START;
  for(let i=0;i<6;i++) {
    now=Math.max(now+3*MIN,p.sounds.s.due+MIN);
    recordRead(p,'sun',{},now);
    gaps.push(Math.round((p.sounds.s.due-now)/DAY));
  }
  assert.deepEqual(gaps,[1,3,7,14,30,30]);
});

test('a round deals at most four cards, and a practice round when nothing is due', () => {
  const p=newProfile();
  for(const w of WORDS) find(p,w,START);
  assert.equal(dueWords(p,START+3*MIN).length,WORDS.length);
  assert.equal(reviewQueue(p,START+3*MIN).length,4);
  for(const w of WORDS) recordRead(p,w,{},START+3*MIN+WORDS.indexOf(w));
  assert.deepEqual(dueWords(p,START+4*MIN),[]);
  assert.deepEqual(reviewQueue(p,START+4*MIN),WORDS.slice(0,4),'the words read longest ago');
});

test('the other pictures are look-alikes and the answer moves', () => {
  const two=newProfile();
  find(two,'cat',START);find(two,'hat',START);
  assert.deepEqual(pictureChoices(two,'cat').sort(),['cat','hat']);
  const p=newProfile(), places=new Set();
  for(const w of WORDS) find(p,w,START);
  for(let i=0;i<60;i++) {
    const cat=pictureChoices(p,'cat'), pig=pictureChoices(p,'pig');
    assert.equal(cat.length,3);
    assert(cat.includes('cup'),'cup starts like cat');
    assert(cat.includes('hat') || cat.includes('mat'),'hat and mat end like cat');
    assert.deepEqual([...pig].sort(),['pen','pig','pot']);
    places.add(cat.indexOf('cat'));
  }
  assert.equal(places.size,3);
});

test('an album saved before sounds were tracked still loads', () => {
  const p=normalise({version:1,stars:14,settings:{voice:true,sounds:'acdghot'},cards:{
    cat:{found:1,due:5e12,box:3,reviews:4,reviewed:9,assisted:false,ink:[]},
    hat:{found:2,due:2e12,box:1,reviews:1,reviewed:8,assisted:true,ink:[]},
    dog:{found:3,due:7,box:0,reviews:0,reviewed:0,assisted:false,ink:[]}}});
  assert.deepEqual(p.sounds.c,{box:3,due:5e12,right:0,wrong:0,seen:0});
  assert.deepEqual(p.sounds.a,{box:1,due:2e12,right:0,wrong:0,seen:0},'a shared sound starts from its least practised word');
  assert.equal(p.cards.cat.due,0,'a word she had read keeps no quick check');
  assert.equal(p.cards.dog.due,7,'a word she had not read yet still gets one');
  assert.equal(p.settings.memoryFirst,true);
  assert.deepEqual(dueWords(p,START),['dog']);
});

test('a saved album loads back unchanged, and anything else starts a new one', () => {
  const p=album(['cat','hat','cup']);
  recordRead(p,'cat',{picked:'cup'},START+DAY);
  assert.deepEqual(normalise(JSON.parse(JSON.stringify(p))),p);
  for(const bad of [null,'x',{},{version:2,cards:{cat:{}}}]) assert.deepEqual(normalise(bad),newProfile());
});
