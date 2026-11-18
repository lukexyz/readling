import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {parseCatalogue} from '../dist/catalogue.js';
import {STAGES,ENTRIES,WORDS,TALES,soundsOf,unitsOf,newProfile,normalise,stageProgress,availableWords,
  findNext,startLesson,collect,reviewQueue,recordRead,swapPairs,packAlbum,mergeAlbum,DAY} from '../dist/game.js';
import {checkWordMedia} from './word-media.mjs';

const starter='cat hat mat dog log pot sun bug cup hen pen pig'.split(' ');
const time=1e12, find=(p,w,when=time)=>{
  assert.equal(startLesson(p,w),true,w);
  p.lesson.i=w.length;return collect(p,when);
};
function fullStarter() {
  const p=newProfile();for(const w of starter)find(p,w);return p;
}
test('a minimal new word inherits its stage; unknown TOML fields do not become game data',()=>{
  const copy=parseCatalogue(`
[[stages]]
number = 1
words = [
  {word="cat", future={version=3, values=[1,2]}},
]
[[stages]]
number = 2
words = [{word='ship', tags=['sh'], difficulty='easy', word_type='noun', theme='sea'}, {word='shop', bonus=true}]
`);
  const {word,stage,difficulty,tags,theme,word_type,bonus,future}=copy.byWord.get('cat');
  assert.deepEqual({word,stage,difficulty,tags,theme,word_type,bonus,future},
    {word:'cat',stage:1,difficulty:'normal',tags:[],theme:undefined,word_type:undefined,bonus:false,future:undefined});
  const ship=copy.byWord.get('ship');
  assert.deepEqual([ship.stage,ship.difficulty,ship.tags,ship.theme,ship.word_type,ship.bonus],[2,'easy',['sh'],'sea','noun',false]);
  assert.deepEqual(copy.stages[1].core.map(e=>e.word),['ship']);
  assert.throws(()=>parseCatalogue("[[stages]]\nnumber=1\nwords=[{word='ship'}, {word='ship'}]"),/duplicate/);
});
test('each unique word has a real picture, MP3s, and one ordered change time per sound after the first',async()=>{
  assert(WORDS.length>=360);
  assert.equal(new Set(WORDS).size,WORDS.length);
  assert.deepEqual(STAGES[0].entries.map(e=>e.word),starter);
  assert.equal(STAGES.reduce((n,s)=>n+s.entries.length,0),WORDS.length);
  const cues=await checkWordMedia();
  for(const w of WORDS) assert.deepEqual(unitsOf(w).flatMap(u=>u.positions).sort((a,b)=>a-b),[...w].map((_,i)=>i));
  assert.deepEqual(soundsOf('ship'),['sh','i','p']);
  assert.deepEqual(unitsOf('cake').map(u=>u.positions),[[0],[1,3],[2]]);
  assert.notDeepEqual(soundsOf('book').slice(1,2),soundsOf('moon').slice(1,2));
  assert(cues.lighthouse.length>4 && TALES.cat);
});
test('normal discovery reaches every word exactly once; unlocking never counts a bonus or a rewrite',()=>{
  const p=newProfile(),seen=new Set(),opened=[];
  assert.deepEqual(availableWords(p),starter);
  assert.equal(startLesson(p,'ship'),false);
  for(let w;(w=findNext(p));) {
    assert(!seen.has(w));seen.add(w);
    const before=stageProgress(p), stage=before.find(s=>s.stage.number===ENTRIES.get(w).stage);
    assert(stage.open);
    const result=find(p,w);
    if(result.unlocked) {
      assert.equal(stage.found,stage.stage.goal-1);
      assert.equal(ENTRIES.get(w).bonus,false);
      assert.equal(ENTRIES.get(findNext(p)).stage,result.unlocked);
      assert([...seen].every(w=>!ENTRIES.get(w).bonus),'the default path to a new stage requires no bonus finds');
      opened.push(result.unlocked);
    }
    assert.equal(find(p,w).unlocked,null);
  }
  assert.equal(seen.size,WORDS.length);
  assert.deepEqual(opened,STAGES.slice(1).map(s=>s.number));
  assert.equal(p.stars,5*WORDS.length);
  assert.deepEqual(Object.keys(normalise(JSON.parse(packAlbum(p))).cards),WORDS);
});
test('a restricted v1 class stays restricted; saved cards, ink and in-progress lessons survive',()=>{
  const p=fullStarter(), ink=[[[11,12],[40,60]]];
  assert.equal(findNext(p,2,true),'shop','bonus finds are available separately as soon as a stage opens');
  p.cards.cat.ink[0]=ink;p.settings.sounds='acst';p.lesson={word:'hat',i:1,ink:[ink,[],[]],help:true};
  const restricted=normalise(p);
  assert.deepEqual(restricted.settings.sounds,['a','c','s','t']);
  assert.deepEqual(restricted.cards.cat.ink[0],ink);assert.deepEqual(restricted.lesson,p.lesson);
  assert.equal(startLesson(restricted,'hat'),true,'an owned card can always be rewritten');
  restricted.settings.sounds=['s','h','i','p'];assert(!availableWords(restricted).includes('ship'));
  restricted.settings.sounds=['sh','i','p'];assert.deepEqual(availableWords(restricted),['ship']);
  p.settings.sounds=[...new Set(starter.join(''))].sort().join('');
  assert.equal(findNext(normalise(p)),'ship','an old default album sees the next stage');
});
test('every graduation keeps the completed badges and opens the next five-piece set',async()=>{
  const p=newProfile(), art=new Set();
  for(const [index,stage] of STAGES.entries()) {
    const current=()=>stageProgress(p)[index];
    const milestones=[1,2,3,4].map(step=>Math.ceil(stage.goal*step/4));
    assert.equal(current().badgeRank,1);
    assert.equal(current().nextBadgeAt,milestones[0]);
    if(STAGES[index+1]) assert.equal(stageProgress(p)[index+1].badgeRank,0);
    for(let i=0;i<stage.goal;i++) {
      const result=find(p,stage.core[i].word), rank=1+milestones.filter(n=>n<=i+1).length;
      assert.equal(current().badgeRank,rank);
      assert.equal(result.badgeEarned,milestones.includes(i+1)?rank:0);
      assert.equal(current().nextBadgeAt,milestones[rank-1] ?? null);
    }
    assert.equal(find(p,stage.core[0].word).badgeEarned,0);
    for(let rank=1;rank<=5;rank++) {
      const path=new URL('../dist/assets/badges/'+stage.badges.id+'-'+rank+'.webp',import.meta.url);
      const data=await readFile(path);
      assert.equal(data.toString('ascii',8,12),'WEBP');
      art.add(createHash('sha256').update(data).digest('hex'));
    }
  }
  assert.equal(art.size,STAGES.length*5);
  assert(stageProgress(normalise(JSON.parse(packAlbum(p)))).every(s=>s.badgeRank===5 && s.nextBadgeAt===null));
});
test('bonus finds, rewrites and memory keep the same badges; merging old albums restores earned sets',()=>{
  assert.equal(stageProgress(newProfile())[0].nextBadgeAt,3);
  const p=fullStarter();
  assert.equal(stageProgress(p)[1].nextBadgeAt,2);
  find(p,'ship');find(p,'shop');find(p,'ship');recordRead(p,'ship');
  assert.equal(stageProgress(p)[1].badgeRank,1);
  assert.equal(stageProgress(p)[1].found,1);
  const other=fullStarter();find(other,'fish');
  const copy=mergeAlbum(normalise(p),normalise(other));
  assert.deepEqual(stageProgress(copy).slice(0,3).map(s=>s.badgeRank),[5,2,0]);
  copy.settings.sounds=[];
  assert.deepEqual(stageProgress(copy).slice(0,3).map(s=>s.badgeRank),[5,2,0]);
});
test('memory attributes a team hint to sh and aligns unequal lengths without marking a shared suffix',()=>{
  const p=fullStarter();for(const w of ['ship','shop','chip'])find(p,w);
  const prior=structuredClone(p.sounds.s), t=time+DAY;
  assert(!recordRead(p,'ship',{asked:['sh']},t));
  assert.deepEqual(p.sounds.s,prior);assert.equal(p.sounds.sh.wrong,1);
  recordRead(p,'ship',{picked:'shop'},t+1);
  assert.equal(p.sounds.i.wrong,1);assert.equal(p.sounds.sh.wrong,1);
  assert(swapPairs(p).some(pair=>pair.includes('ship') && pair.includes('chip')));
  assert(!swapPairs(p).some(pair=>pair.includes('ship') && pair.includes('pig')));
  const copy=mergeAlbum(newProfile(),normalise(p));assert.equal(copy.sounds.sh.wrong,1);
  assert(reviewQueue(copy,t+180000).every(w=>copy.cards[w]));
  // A longer choice sharing all the target sounds is still a wrong first answer.
  const long=fullStarter();while(!long.cards.stamp)find(long,findNext(long));
  assert.equal(recordRead(long,'stamp',{picked:'stump'},t),false);
  assert(!recordRead(long,'ship',{picked:'shrimp'},t));
  assert.equal(long.cards.ship.assisted,true);
});
