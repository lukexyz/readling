import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {SHOW,newProfile,normalise,startLesson,collect,finishTask,showChoices,showDue,addToShow,mergeAlbum,packAlbum} from '../dist/game.js';
import {dolphinFamilies,dolphinShots,dolphinPoster} from '../dist/dolphins.js';
import {flowerFamilies,flowerShots} from '../dist/gardens.js';
// Checks for the celebration show she builds, in dist/game.js: what is offered, when, and how it is saved.
// They use words from the first collection, so they need updating if those words change.
const START=1e12;
function find(p,word) {
  startLesson(p,word);p.lesson.i=word.length;
  return collect(p,START);
}
const copy=p=>normalise(JSON.parse(JSON.stringify(p)));

test('each flower family unlocks one level at a time, including in an older Flowers album', () => {
  const base=newProfile();
  base.show={tasks:99,picks:['flowers']};
  assert.deepEqual(copy(base).show.picks,['flowers']);
  for (const family of flowerFamilies) {
    const album=copy(base), levels=family.shots.map(shot=>shot.id);
    // Own the other rewards, so the two-choice limit cannot hide an eligible level.
    album.show.picks=SHOW.map(part=>part.id).filter(id=>!levels.includes(id) || id==='flowers');
    for (const id of levels.filter(id=>!album.show.picks.includes(id))) {
      assert.deepEqual(showChoices(album),[id]);
      assert(addToShow(album,id));
    }
    assert.deepEqual(showChoices(album),[]);
    assert.deepEqual(copy(album).show.picks,album.show.picks);
  }
  const fresh=newProfile();
  for (const family of flowerFamilies) {
    const [one,two,three]=family.shots;
    assert.equal(one.after,undefined);
    assert.equal(two.after,one.id);
    assert.equal(three.after,two.id);
    assert(!addToShow(fresh,three.id));
  }
});

test('mixed gardens and splash previews play the highest earned flower in each family', async () => {
  const {planShow}=await import('../dist/finale.js');
  const picks=['flowers','poppy-2','moonflower-1','sunflower-1','sunflower-2','sunflower-3','oak','splash'];
  const flowerActs=show=>show.acts.filter(([id])=>flowerShots.some(shot=>shot.id===id));
  for (const alone of ['', 'splash']) {
    const show=planShow({picks,alone});
    const beds=flowerActs(show);
    assert.deepEqual(beds.map(([id])=>id),['poppy-2','moonflower-1','sunflower-3']);
    assert(beds.every(([,start,len,stays])=>stays && start+len<=show.total));
  }
  for (const shot of flowerShots) {
    const show=planShow({picks,alone:shot.id});
    assert.deepEqual(flowerActs(show).map(([id])=>id),[shot.id]);
    const manifest=JSON.parse(await readFile(new URL(shot.still.replace('-poster.png','.json'))));
    assert.equal(manifest.frames.length,shot.frames);
  }
  const a=copy({...newProfile(),show:{picks:['flowers','moonflower-1'],tasks:14}});
  const b=copy({...newProfile(),show:{picks:['flowers','poppy-2','sunflower-1'],tasks:18}});
  mergeAlbum(a,b);
  assert.deepEqual(new Set(a.show.picks),new Set(['flowers','poppy-2','moonflower-1','sunflower-1']));
});

test('an older show keeps its earned oak when the snail retires', () => {
  const p=newProfile();
  p.show={tasks:12,picks:['snail','oak','music']};
  const album=copy(p);
  assert.deepEqual(new Set(album.show.picks),new Set(['oak','music']));
  assert.equal(album.show.tasks,12);
  assert(!SHOW.some(part=>part.id==='snail'));
});

test('all twelve garden studies have playable transparent sheets and a gallery still', async () => {
  const folder=new URL('../dist/assets/flower-studies/',import.meta.url);
  for (const family of ['poppy','sunflower','moonflower','oak']) {
    for (const level of [1,2,3]) {
      const stem=family+'-'+level;
      const {frames,sheets}=JSON.parse(await readFile(new URL(stem+'.json',folder)));
      assert(frames.length>=60 && frames.length<=96,stem);
      for (const frame of frames) {
        assert.equal(frame.length,7,stem);
        const [sheet,,,w,h,x,y]=frame;
        assert(sheets[sheet] && w>0 && h>0 && x>=0 && y>=0 && x+w<=480 && y+h<=360,stem);
      }
      await Promise.all(sheets.map(name=>access(new URL(name,folder))));
      await access(new URL(stem+'-poster.'+(family==='oak'?'webp':'png'),folder));
    }
  }
});

test('a show with only the earned oak runs through the last acorn bounce', async () => {
  const {planShow}=await import('../dist/finale.js');
  const show=planShow({picks:['oak']});
  const [,start,duration]=show.acts.find(([id])=>id==='oak');
  assert.equal(duration,94/24);
  assert(show.total>=start+duration);
});
// Adds whatever is offered, one choice at a time, always leaving the picks named in avoid.
function build(p,avoid=[]) {
  for(let guard=0;guard<60;guard++) {
    while(!showDue(p) && showChoices(p).length) finishTask(p);
    const id=showChoices(p).find(id=>!avoid.includes(id));
    if(!id) return;
    assert(addToShow(p,id));
  }
}

test('her first task earns a choice of rainbow or music, then every second task earns another', () => {
  const p=newProfile();
  assert.equal(showDue(p),false);
  find(p,'cat');
  assert.equal(showDue(p),true);
  assert.deepEqual(showChoices(p),['rainbow','music']);
  assert.equal(addToShow(p,'stars'),false,'only what is on offer can be added');
  assert.equal(addToShow(p,'music'),true);
  assert.equal(showDue(p),false);
  assert.equal(addToShow(p,'rainbow'),false,'nothing more until she has earned it');
  finishTask(p);
  assert.equal(showDue(p),false);
  find(p,'mat');
  assert.equal(showDue(p),true);
  assert.deepEqual(showChoices(p),['rainbow','stars'],'the one she left comes back beside something new');
});

test('writing a word again is not a new task', () => {
  const p=newProfile();
  find(p,'cat');find(p,'cat');
  assert.equal(p.show.tasks,1);
});

test('some picks wait for an earlier pick, a word or a number of finds', () => {
  const p=newProfile();
  find(p,'cat');
  build(p,['rainbow']);
  assert(!p.show.picks.includes('rainbow'));
  for(const id of ['rainbow2','slide','ribbon']) assert(!p.show.picks.includes(id),id+' needs the rainbow');
  assert(!p.show.picks.includes('parade'),'the parade needs two finds');
  assert(!p.show.picks.includes('hats'),'hats need the hat');
  assert(p.show.picks.includes('whale') && p.show.picks.includes('splash'));
  find(p,'hat');
  assert.deepEqual(showChoices(p),['rainbow','parade'],'the rainbow she keeps leaving is still offered');
  build(p,['rainbow']);
  assert(p.show.picks.includes('parade') && p.show.picks.includes('hats'));
});

test('everything in the list can be added, and then nothing more is offered', () => {
  const p=newProfile();
  find(p,'cat');find(p,'hat');
  build(p);
  assert.deepEqual(p.show.picks,SHOW.map(s=>s.id));
  assert.deepEqual(showChoices(p),[]);
  assert.equal(showDue(p),false);
});

test('an existing album can upgrade its original Whale pick through all three orcas', () => {
  const p=newProfile();
  find(p,'cat');find(p,'hat');
  p.show={tasks:100,picks:SHOW.map(s=>s.id).filter(id=>!['whale','whale2','whale3','splash'].includes(id))};
  const album=copy(p);
  assert.deepEqual(showChoices(album),['whale']);
  assert(addToShow(album,'whale'));
  assert.deepEqual(showChoices(album),['splash','whale2']);
  assert(addToShow(album,'whale2'));
  assert.deepEqual(showChoices(album),['splash','whale3']);
  assert(addToShow(album,'whale3'));
  assert.deepEqual(copy(album).show,album.show);
});

test('one orca plays and the extra rain follows the active level’s contact', async () => {
  const {planShow}=await import('../dist/finale.js');
  const picks=['rainbow','flowers','splash'];
  for(const [id,frames,contact] of [['whale',72,48],['whale2',86,44],['whale3',126,68]]) {
    picks.push(id);
    for(const alone of ['', 'splash']) {
      const {acts}=planShow({picks,alone});
      const whales=acts.filter(([name])=>name.startsWith('whale'));
      assert.deepEqual(whales.map(([name])=>name),[id]);
      assert.equal(whales[0][2],frames/30);
      assert.equal(acts.find(([name])=>name==='splash')[1],whales[0][1]+contact/30);
    }
  }
  assert.deepEqual(planShow({picks,alone:'whale'}).acts.map(([id])=>id),['whale']);
});

test('an album from before the show counts each find as a task', () => {
  const p=newProfile();
  for(const w of ['cat','hat','mat']) find(p,w);
  const old=JSON.parse(JSON.stringify(p));
  delete old.show;
  const loaded=normalise(old);
  assert.deepEqual(loaded.show,{picks:[],tasks:3});
  assert.equal(showDue(loaded),true);
  addToShow(loaded,'rainbow');
  assert.equal(showDue(loaded),true,'three finds are worth two picks');
  addToShow(loaded,'music');
  assert.equal(showDue(loaded),false);
});

test('legacy Dolphins starts at First skim and all eight approved upgrades can be earned', () => {
  const p=newProfile();
  const newPicks=dolphinShots.slice(1).map(shot=>shot.id);
  p.show={tasks:100,picks:SHOW.map(s=>s.id).filter(id=>!newPicks.includes(id))};
  const saved=copy(p);
  assert(saved.show.picks.includes('dolphins'));
  assert.equal(SHOW.find(s=>s.id==='dolphins').title,'First skim');
  const relay=dolphinFamilies.find(f=>f.id==='relay').levels;
  assert.deepEqual(relay.map(s=>[s.take,s.title,s.after]),[
    ['relay-1','Long glide',undefined],['relay-3','Pod in flight',relay[0].id]
  ]);
  assert.deepEqual(dolphinFamilies.map(f=>f.levels.length),[3,3,2]);
  for(const family of dolphinFamilies) {
    for(const shot of family.levels.slice(1)) {
      if(shot.after!=='dolphins') assert(!addToShow(saved,shot.id));
    }
  }
  assert(addToShow(saved,dolphinFamilies[0].levels[1].id));
  build(saved);
  assert.deepEqual(copy(saved).show.picks,SHOW.map(s=>s.id));
});

test('dolphins share a visitor slot and rotate fairly alongside other visitors', async () => {
  const {planShow}=await import('../dist/finale.js');
  const selected=new Set(dolphinShots.map(s=>s.id));
  const picks=[...selected,'bunnies','elephants','parade','whale3'];
  const highest=dolphinFamilies.map(f=>f.levels.at(-1).id);
  const played=options=>planShow({picks,...options}).acts.filter(([id])=>selected.has(id));
  assert.deepEqual(played({all:true}).map(([id])=>id),highest);
  const counts=new Map(highest.map(id=>[id,0]));
  for(let turn=0;turn<12;turn++) {
    const cast=played({turn});
    assert(cast.length<=1);
    if(cast.length) counts.set(cast[0][0],counts.get(cast[0][0])+1);
  }
  assert.deepEqual([...counts.values()],[2,2,2]);
  for(const shot of dolphinShots) {
    assert.deepEqual(played({alone:shot.id}).map(([id,,len])=>[id,len]),[[shot.id,shot.frames/30]]);
  }
});

test('each dolphin has its Blender frames, gallery still and matching earned-hat track', async () => {
  const assets=new URL('../dist/assets/dolphins/',import.meta.url);
  const hats=JSON.parse(await readFile(new URL('hats.json',assets),'utf8'));
  assert.deepEqual(Object.keys(hats).sort(),dolphinShots.map(s=>s.take).sort());
  for(const shot of dolphinShots) {
    const {frames,sheets}=JSON.parse(await readFile(new URL(shot.take+'.json',assets),'utf8'));
    assert.equal(frames.length,shot.frames);
    assert(frames[shot.poster-1]);
    assert.equal(hats[shot.take].length,frames.length);
    assert(hats[shot.take].some(frame=>frame.length));
    await Promise.all([access(new URL(dolphinPoster(shot))),...sheets.map(file=>access(new URL(file,assets)))]);
  }
});

test('a saved show loads back in list order, without anything unknown', () => {
  const p=newProfile();
  find(p,'cat');
  p.show={picks:['whale','nonsense','rainbow','whale'],tasks:4.7};
  assert.deepEqual(copy(p).show,{picks:['rainbow','whale'],tasks:4});
  p.show='broken';
  assert.deepEqual(copy(p).show,{picks:[],tasks:1});
});

test('two tablets keep everything added on either, and pack the same copy', () => {
  const a=newProfile(), b=newProfile();
  find(a,'cat');find(b,'cat');
  a.show={picks:['rainbow','stars'],tasks:5};
  b.show={picks:['music','stars','bunnies'],tasks:3};
  const ab=mergeAlbum(copy(a),copy(b)), ba=mergeAlbum(copy(b),copy(a));
  assert.deepEqual(ab.show,{picks:['rainbow','music','stars','bunnies'],tasks:5});
  assert.deepEqual(ba.show,ab.show);
  assert.equal(packAlbum(ab),packAlbum(ba));
});
