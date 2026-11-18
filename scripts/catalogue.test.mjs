import test from 'node:test';
import assert from 'node:assert/strict';
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
