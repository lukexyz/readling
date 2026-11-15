import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY,newProfile,normalise,startLesson,collect,recordRead,mergeAlbum,packAlbum} from '../dist/game.js';
// Checks for combining two copies of an album and for packing one to save, in dist/game.js.
// They use words from the first collection, so they need updating if those words change.
const MIN=60000, START=1e12;
function find(p,word,now) {
  startLesson(p,word);p.lesson.i=word.length;
  return collect(p,now);
}
const copy=p=>normalise(JSON.parse(JSON.stringify(p)));
// Two tablets that share one find. The first read cat a day later, the second slipped on dog after that.
function tablets() {
  const a=newProfile(), b=newProfile();
  find(a,'cat',START);find(a,'hat',START);
  find(b,'cat',START+MIN);find(b,'dog',START+MIN);
  recordRead(a,'cat',{},START+DAY);
  recordRead(b,'dog',{picked:'cat'},START+2*DAY);
  return [a,b];
}

test('two tablets keep every find, and the copy used most recently', () => {
  const [a,b]=tablets();
  mergeAlbum(a,copy(b));
  assert.deepEqual(Object.keys(a.cards).sort(),['cat','dog','hat']);
  assert.equal(a.cards.cat.reviews,1,'her later read of cat is kept');
  assert.equal(a.cards.dog.assisted,true);
  assert.equal(a.sounds.c.box,1);
  assert.equal(a.sounds.d.wrong,1);
  assert.equal(a.stars,15,'five stars for each find at least');
});

test('combining in either order gives the same album', () => {
  const [a,b]=tablets();
  const ab=mergeAlbum(copy(a),copy(b)), ba=mergeAlbum(copy(b),copy(a));
  assert.deepEqual(ab.cards,ba.cards);
  assert.deepEqual(ab.sounds,ba.sounds);
  assert.equal(ab.stars,ba.stars);
  assert.deepEqual(mergeAlbum(copy(ab),copy(ba)),ab,'and combining again changes nothing');
  assert.notEqual(JSON.stringify(ab),JSON.stringify(ba),'the two tablets list their sounds in a different order');
  assert.equal(packAlbum(ab),packAlbum(ba),'but pack the same copy, so neither saves it again');
});

test('a tablet with no finds takes the saved settings and scene, and keeps a word she has started', () => {
  const saved=newProfile();
  for(const w of ['cat','hat','mat']) find(saved,w,START);
  saved.settings.fanfare=false;saved.scene=[{word:'cat',x:20,y:30}];
  const fresh=newProfile();
  startLesson(fresh,'dog');
  mergeAlbum(fresh,copy(saved));
  assert.equal(fresh.settings.fanfare,false);
  assert.deepEqual(fresh.scene,[{word:'cat',x:20,y:30}]);
  assert.equal(fresh.lesson.word,'dog');
  const played=newProfile();
  find(played,'dog',START);
  mergeAlbum(played,copy(saved));
  assert.equal(played.settings.fanfare,true,'a tablet she has played on keeps its own settings');
  assert.deepEqual(played.scene,[]);
});

test('an empty saved copy changes nothing', () => {
  const p=newProfile();
  startLesson(p,'cat');p.settings.voice=false;
  const before=copy(p);
  assert.deepEqual(mergeAlbum(p,newProfile()),before);
});

test('a saved copy is the whole album when it fits', () => {
  const [a]=tablets();
  a.cards.cat.ink[0]=[[[10,20],[30.5,40],[50,60.5]]];
  assert.deepEqual(normalise(JSON.parse(packAlbum(a))),copy(a));
});

test('heavy scribbles are thinned until the copy fits', () => {
  const p=newProfile();
  find(p,'cat',START);
  const scribble=()=>Array.from({length:40},()=>Array.from({length:900},(_,i)=>[i%180+.5,i*7%138+.5]));
  p.cards.cat.ink=[scribble(),scribble(),scribble()];
  assert(JSON.stringify(p).length>900000);
  for(const limit of [900000,100000]) {
    const json=packAlbum(p,limit), ink=normalise(JSON.parse(json)).cards.cat.ink;
    assert(json.length<=limit);
    for(const lines of ink) {
      assert.equal(lines.length,40);
      for(const line of lines) {
        assert(line.length>20 && line.length<900);
        assert.deepEqual([line[0],line.at(-1)],[[.5,.5],[179.5,83.5]],'each line keeps its two ends');
      }
    }
  }
  assert.equal(p.cards.cat.ink[0][0].length,900,'the album on the tablet is left as it was');
});
