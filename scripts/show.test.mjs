import test from 'node:test';
import assert from 'node:assert/strict';
import {SHOW,newProfile,normalise,startLesson,collect,finishTask,showChoices,showDue,addToShow,mergeAlbum,packAlbum} from '../dist/game.js';
// Checks for the celebration show she builds, in dist/game.js: what is offered, when, and how it is saved.
// They use words from the first collection, so they need updating if those words change.
const START=1e12;
function find(p,word) {
  startLesson(p,word);p.lesson.i=word.length;
  return collect(p,START);
}
const copy=p=>normalise(JSON.parse(JSON.stringify(p)));
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
