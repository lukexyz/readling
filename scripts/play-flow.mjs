// Exercise the shipped Worker in Chromium. Its public R2 artwork is supplied by
// the matching local files; no account, remote storage or speech service is used.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import worker from '../dist/server/index.js';
import {KEY,STAGES,SHOW,unitsOf,newProfile,findNext,startLesson,collect} from '../dist/game.js';
import {flowerShots} from '../dist/gardens.js';

const dist=new URL('../dist/',import.meta.url), origin='http://readling.test';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined,args:['--disable-logging']});
const errors=[];
async function openGame(seed, motion='reduce', screen={}) {
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:motion,...screen});
  await context.route('**/*',async route=>{
    const req=route.request(), url=new URL(req.url());
    if(url.origin!==origin) return route.abort();
    const lookup=async key=>{
      if(!key.startsWith('celebration-art/')) return null;
      const body=await readFile(new URL('.'+url.pathname,dist));
      assert.equal(key,'celebration-art/'+createHash('sha256').update(body).digest('hex'));
      return {body};
    };
    const res=await worker.fetch(new Request(url,{method:req.method(),headers:req.headers()}),
      {BUCKET:{get:lookup,head:lookup,list:async()=>({objects:[]})}});
    if(res.status>=400) errors.push(req.url()+' '+res.status);
    await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())});
  });
  await context.addInitScript(({key,seed})=>{
    if(seed && !localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));
    window.played=[];
    // Observe real playback, including the finale's detached Audio element.
    window.Audio=class extends Audio {
      constructor(...args){super(...args);this.addEventListener('playing',()=>{if(!this.muted) window.played.push(new URL(this.currentSrc).pathname);});}
    };
  },{key:KEY,seed});
  const page=await context.newPage();page.setDefaultTimeout(8000);
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(origin+'/');
  await page.getByRole('heading',{name:'The Word Woods'}).waitFor();
  return page;
}
const act=(p,name)=>p.locator('button[data-act="'+name+'"]:visible').first().click();
const saved=p=>p.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
async function picture(p,word,owner) {
  const img=p.locator(owner+' img[alt="'+word+'"]').first();
  await img.scrollIntoViewIfNeeded();
  await img.evaluate(async im=>{await im.decode();if(!im.naturalWidth)throw Error('Picture did not decode');});
}
async function writeStroke(p) {
  const pad=p.locator('#inkpad');await pad.scrollIntoViewIfNeeded();
  const box=await pad.boundingBox();assert(box.width>70,'writing pad remains usable on a phone');
  await p.mouse.move(box.x+box.width*.4,box.y+box.height*.3);await p.mouse.down();
  await p.mouse.move(box.x+box.width*.6,box.y+box.height*.65,{steps:4});await p.mouse.up();
}
async function traceAndBlend(p,word,first=0) {
  await p.locator('.copy-word[aria-label="'+word+'"]').waitFor();
  for(let i=first;i<word.length;i++){
    const pos=unitsOf(word).findIndex(u=>u.positions.includes(i));
    assert.equal(await p.locator('.copy-word .current').count(),unitsOf(word)[pos].positions.length);
    await writeStroke(p);
    await act(p,'next-sound');
  }
  assert.equal(await p.locator('#blend-track').getAttribute('aria-valuemax'),String(unitsOf(word).length));
  await p.locator('#blend-track').focus();await p.keyboard.press('ArrowRight');
  assert.equal(await p.locator('.blend-print .blended').count(),unitsOf(word)[0].positions.length);
  await act(p,'blend-help');
  await p.waitForFunction(w=>window.played.includes('/assets/audio/blends/'+w+'.mp3'),word);
  await p.waitForFunction(()=>{const b=document.querySelector('#blend-track');return b.ariaValueNow===b.ariaValueMax;});
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no sideways scrolling');
  await act(p,'reveal');
  await picture(p,word,'.reveal-art');await p.locator('main .handwritten').waitFor();
  assert.equal((await saved(p)).cards[word].ink.length,word.length);
}
function before(target) {
  const p=newProfile();p.settings.sparkles=false;p.settings.voice=false;p.settings.memoryFirst=false;
  while(findNext(p)!==target){const w=findNext(p);assert(w,'Target reachable: '+target);startLesson(p,w);p.lesson.i=w.length;collect(p);}
  return p;
}
async function checkCelebrationSize() {
  const page=await openGame(null,'no-preference',{viewport:{width:1024,height:768},deviceScaleFactor:2,hasTouch:true});
  await page.locator('summary.stars').tap();
  await page.locator('.badge-pocket').getByRole('heading',{name:'Oak keepsakes'}).waitFor();
  const starter=page.locator('.badge-pocket img[src$="/oak-1.webp"]').first();
  await starter.evaluate(im=>im.decode());
  await page.keyboard.press('Escape');
  // Measure real atlas draws, including their transform to the backing canvas.
  await page.evaluate(()=>{
    const draw=CanvasRenderingContext2D.prototype.drawImage;
    window.shotDraws=[];
    CanvasRenderingContext2D.prototype.drawImage=function(image,...args) {
      if(args.length===8 && image.src && /\/assets\/(woodland|dolphins|ember-orca|flower-studies|prism)\//.test(image.src)) {
        const transform=this.getTransform();
        window.shotDraws.push({layer:this.canvas.className,scaleX:Math.hypot(transform.a,transform.b)*args[6]/args[2],
          scaleY:Math.hypot(transform.c,transform.d)*args[7]/args[3]});
      }
      return draw.call(this,image,...args);
    };
  });
  async function measure(id,expected,layerName='show-floor') {
    await page.waitForFunction(()=>window.shotDraws.length>0);
    const result=await page.evaluate(layerName=>{
      const floor=document.querySelector('.'+layerName), box=floor.getBoundingClientRect();
      const panel=floor.closest('.victory')?.getBoundingClientRect();
      return {draws:window.shotDraws,top:box.top,bottom:box.bottom,height:box.height,h:innerHeight,
        left:box.left,panel:panel?.toJSON(),
        pixels:floor.height,cssWidth:box.width,width:floor.width,dpr:devicePixelRatio};
    },layerName);
    if(layerName==='show-visitors') {
      assert(Math.abs(result.bottom-result.panel.bottom)<=2,id+' sits on the panel baseline');
      assert(result.left>result.panel.left+result.panel.width*.5,id+' is on the right side of the word panel');
    } else assert(Math.abs(result.bottom-result.h)<1 && result.height<=result.h*.28+1,id+' stays in the bottom strip');
    assert.equal(result.width,Math.round(result.cssWidth*result.dpr));
    assert.equal(result.pixels,Math.round(result.height*result.dpr));
    for(const {layer,scaleX,scaleY} of result.draws) {
      assert.equal(layer,layerName,id);
      assert(Math.abs(scaleX-scaleY)<.0001 && scaleX>0 && scaleX<=1.0001,id+' preserves native proportions and resolution');
      if(expected!==undefined) assert(Math.abs(scaleX-expected)<.001,id+' uses native pixels when it fits');
    }
    return result;
  }
  await act(page,'parents');await act(page,'trial');
  await page.locator('[data-act="trial-one"][data-pick="bunnies"]').tap();
  const bunnyFrame=await measure('Grown-ups bunny',undefined,'show-visitors');
  assert(Math.abs(bunnyFrame.draws[0].scaleY*360/bunnyFrame.dpr-104)<1,'even a solo bunny fits a 104 CSS pixel camera frame');
  // Snapshot one real frame from each renderer without waiting out seven shows.
  for(const id of ['elephants-3','dolphins','whale3','flowers','oak','blooms-3','rainbow']) {
    await page.evaluate(async id=>{
      const {launchFinale}=await import('/finale.js');
      window.shotDraws=[];launchFinale(null,{alone:id,word:'cat',freeze:1.25});
    },id);
    await measure(id,1);
  }
  await page.setViewportSize({width:720,height:360});
  await page.evaluate(async()=>{
    const {launchFinale}=await import('/finale.js');
    window.shotDraws=[];launchFinale(null,{picks:['bunnies'],word:'cat',freeze:2.4});
  });
  const small=await measure('bunny in a mixed show');
  assert(Math.abs(small.draws[0].scaleY-small.pixels/360)<.001,'short viewports scale the camera frame down to fit');
  await page.evaluate(async()=>{(await import('/finale.js')).cancelFinale();});
  assert.equal(await page.locator('.show-floor,.fireworks-screen').count(),0);
  const albumBeforeViewer=await saved(page);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(origin+'/animation-viewer.html');
  const pick=page.locator('#picker');
  await page.getByRole('button',{name:'Replay',exact:true}).waitFor();
  assert.equal(await pick.inputValue(),'bunnies');
  const listed=await pick.locator('option').evaluateAll(opts=>opts.map(o=>o.value));
  assert.deepEqual(listed.toSorted(),[...SHOW.map(effect=>effect.id),'comet','tally','rosette'].toSorted());
  const box=await page.locator('#bounds').boundingBox(), panel=await page.locator('#scene').boundingBox();
  assert(box && box.height<=74 && box.x>panel.x+panel.width/2 && box.y+box.height<=panel.y+panel.height,
    'the viewer measures the actual bunny in the lower-right corner of the panel');
  assert.equal(await page.locator('#bottom-label').textContent(),'Panel bottom');
  const bottom=await page.locator('#bottom').textContent();
  await page.evaluate(()=>window.scrollTo(0,120));
  await page.waitForFunction(y=>document.querySelector('#bounds').getBoundingClientRect().y<y-30,box.y);
  assert.equal(await page.locator('#bottom').textContent(),bottom,'scrolling leaves the rabbit on the same ground');
  await page.getByRole('button',{name:'Previous animation',exact:true}).tap();
  assert.equal(await pick.inputValue(),'rosette');
  await page.keyboard.press('ArrowRight');
  await page.getByRole('button',{name:'Replay',exact:true}).waitFor();
  assert.equal(await pick.inputValue(),'bunnies');
  await page.locator('#timeline').fill('0.9');
  assert((await page.locator('#clock').textContent()).startsWith('0.9'));
  for(const shot of flowerShots) {
    await pick.selectOption(shot.id);
    await page.getByRole('button',{name:'Replay',exact:true}).waitFor();
    const bloom=await page.locator('#bounds').boundingBox(), meadow=await page.locator('#word-stage').boundingBox();
    assert.equal(await page.locator('.meadow-flower canvas').count(),1);
    assert.equal(await page.locator('#bottom-label').textContent(),'Meadow bottom');
    assert(bloom && bloom.x>=meadow.x && bloom.x+bloom.width<meadow.x+meadow.width*.36 &&
      bloom.y>=meadow.y && bloom.y+bloom.height<=meadow.y+meadow.height,shot.name+' grows inside the illustrated meadow');
    assert(parseInt(await page.locator('#bottom').textContent(),10)<30,shot.name+' stays rooted in the grass');
  }
  for(const id of ['elephants','elephants-2','elephants-3']) {
    await pick.selectOption(id);
    await page.getByRole('button',{name:'Replay',exact:true}).waitFor();
    const herd=await page.locator('#bounds').boundingBox(), scene=await page.locator('#scene').boundingBox();
    const meadow=await page.locator('#word-stage').boundingBox();
    assert(herd && herd.width>24 && herd.x>=scene.x && herd.x+herd.width<scene.x+scene.width/2 &&
      herd.y>=meadow.y+meadow.height && herd.y+herd.height<=scene.y+scene.height,id+' sits below the meadow on the left');
  }
  assert.deepEqual(await saved(page),albumBeforeViewer,'a review session never changes the album');
  await page.context().close();
}
async function checkMixedMeadow() {
  const album=newProfile();
  startLesson(album,'cat');album.lesson.i=3;collect(album);
  album.show={tasks:18,picks:['flowers','poppy-2','moonflower-1','sunflower-1','bunnies','elephants']};
  album.settings.voice=false;album.settings.fanfare=false;
  const page=await openGame(album,'reduce',{viewport:{width:390,height:760},deviceScaleFactor:3,hasTouch:true});
  await act(page,'album');
  await page.locator('[data-act="card"][data-word="cat"]').click();await act(page,'album-encore');
  const beds=page.locator('.show-stage .meadow-flower');
  assert.deepEqual(await beds.evaluateAll(nodes=>nodes.map(n=>n.dataset.meadowFlower)),['poppy-2','moonflower-1','sunflower-1']);
  const posters=beds.locator('img');
  const sizes=await posters.evaluateAll(async images=>Promise.all(images.map(async image=>{
    await image.decode();return [image.clientWidth,image.clientHeight];
  })));
  await page.emulateMedia({reducedMotion:'no-preference'});
  await act(page,'encore');
  const wings=page.locator('.found.show-playing > .show-visitors');
  const left=wings.and(page.locator('[data-side="left"]')), right=wings.and(page.locator('[data-side="right"]'));
  await left.waitFor();await right.waitFor();
  const [l,r,actionRow]=await Promise.all([left.boundingBox(),right.boundingBox(),page.locator('.found .actions').first().boundingBox()]);
  assert(l.x+l.width<r.x && Math.min(l.y,r.y)>=actionRow.y+actionRow.height,'the two visitors have clear space below the phone controls');
  assert.deepEqual(await beds.locator('canvas').evaluateAll(layers=>layers.map(c=>[c.clientWidth,c.clientHeight])),sizes,
    'animated flowers and their stills occupy exactly the same places in the word meadow');
  for(const poster of await posters.all()) assert(await poster.isHidden());
  // Count painted pixels on both sides in the same frame of an actual encore.
  await page.waitForFunction(()=>{
    const layers=[...document.querySelectorAll('.found > .show-visitors')];
    return layers.length===2 && layers.every(c=>{
      const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      for(let i=3;i<data.length;i+=16) if(data[i]>180) return true;
      return false;
    });
  },null,{timeout:15000});
  await page.locator('.found > .show-visitors').first().waitFor({state:'detached',timeout:16000});
  assert.equal(await beds.locator('canvas').count(),0);
  for(const poster of await posters.all()) assert(await poster.isVisible());
  await page.context().close();
}
async function checkWritingBack() {
  const p=await openGame(before('mat'));
  await act(p,'discover');
  const back=p.locator('[data-act="previous-sound"]');
  assert.equal(await back.count(),0);
  await writeStroke(p);await act(p,'next-sound');await writeStroke(p);
  const ink=(await saved(p)).lesson.ink;
  assert(ink[0].length && ink[1].length);
  for(const [width,height] of [[1440,900],[1024,768],[1024,640],[844,390],[568,320],[390,740],[320,568]]) {
    await p.setViewportSize({width,height});
    await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const [prev,next]=await p.locator('.rest-pad>button').evaluateAll(buttons=>buttons.map(button=>{
      const cell=button.parentElement,box=button.getBoundingClientRect(),tile=cell.getBoundingClientRect();
      const ink=cell.querySelector('.rest-writing')?.getBoundingClientRect();
      return {act:button.dataset.act,centerOffset:box.left+box.width/2-tile.left-tile.width/2,
        bottom:tile.bottom-box.bottom,right:tile.right-box.right,inView:box.bottom<=innerHeight+1,
        inkClear:!ink || ink.right<=box.left+1 || ink.bottom<=box.top+1,
        width:box.width,height:box.height,icon:button.querySelector('svg').getBoundingClientRect().width};
    }));
    assert.equal(prev.act,'previous-sound');assert.equal(next.act,'next-sound');
    assert(prev.bottom>=0 && prev.bottom<=12 && prev.right>=0 && prev.right<=12 && prev.icon===26 && prev.inkClear);
    assert(Math.abs(next.centerOffset)<1 && prev.inView && next.inView,JSON.stringify({width,height,prev,next}));
    assert(Math.min(prev.height,next.height,prev.width,next.width)>=44,'Both buttons must be easy to tap');
  }
  await back.click();await p.locator('#inkpad:focus').waitFor();
  assert.equal(await p.locator('#inkpad .ink-lines path').count(),0);
  assert.deepEqual((await saved(p)).lesson.ink,[[],ink[1],[]]);
  assert(await p.locator('.rest-pad.has-ink .btn').evaluate(button=>button.getBoundingClientRect().top>=button.parentElement.querySelector('svg').getBoundingClientRect().bottom-1));
  await act(p,'next-sound');await p.reload();
  assert.deepEqual((await saved(p)).lesson.ink,[[],ink[1],[]]);
  assert.equal(await p.locator('#inkpad .ink-lines path').count(),ink[1].length);
  await act(p,'next-sound');await writeStroke(p);await p.getByRole('button',{name:'Say my word!'}).click();
  await p.getByRole('button',{name:'Retry letter t'}).click();
  assert.equal((await saved(p)).lesson.i,2);
  assert.deepEqual((await saved(p)).lesson.ink,[[],ink[1],[]]);
  await p.context().close();
}
async function observeScoreAudio(p) {
  await p.evaluate(()=>{
    window.scoreNotes=[];
    const start=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...args) {
      const data=this.buffer.getChannelData(0), rate=this.buffer.sampleRate;
      const from=Math.floor(rate*.12), to=Math.floor(rate*.32);
      let crossings=0;
      for(let i=from+1;i<to;i++) if(data[i-1]<=0 && data[i]>0) crossings++;
      window.scoreNotes.push({hz:crossings*rate/(to-from),score:Number(document.querySelector('.stars b').textContent)});
      return start.apply(this,args);
    };
  });
}
async function checkLaptopReward() {
  const album=before('dog');album.settings.sparkles=true;
  startLesson(album,'dog');album.lesson.i=3;
  for(const [music,mediaOnly] of [[true,false],[false,false],[true,true]]) {
    album.settings.fanfare=music;
    const p=await openGame(album,'reduce',{viewport:{width:1343,height:760}});
    if(mediaOnly) await p.evaluate(()=>{window.AudioContext=undefined;window.webkitAudioContext=undefined;});
    await observeScoreAudio(p);
    await act(p,'discover');await act(p,'reveal');
    await p.getByRole('heading',{name:'Look what you found!'}).waitFor();
    if(await p.locator('#sticker-picker').isVisible()) await p.getByRole('button',{name:'Later'}).click();
    for(const [width,height] of [[1343,760],[1280,680],[1440,900]]) {
      await p.setViewportSize({width,height});
      const boxes=await p.evaluate(()=>['.found','.found>.show-stage','.found-details','.found>.actions'].map(s=>document.querySelector(s).getBoundingClientRect().toJSON()));
      const [card,meadow,details,actions]=boxes;
      assert(Math.abs(meadow.x+meadow.width/2-card.x-card.width/2)<1 && details.top>=meadow.bottom-1,'The MacBook meadow is centered above the word');
      assert(actions.top>=details.bottom-1 && actions.bottom<=height+1,'Reward buttons fit a '+width+'×'+height+' laptop: '+JSON.stringify(boxes));
    }
    if(mediaOnly) {
      await p.waitForFunction(()=>window.played.filter(s=>s.includes('/star-piano-')).length===5);
      assert.deepEqual(await p.evaluate(()=>window.played.filter(s=>s.includes('/star-piano-'))),
        [1,2,3,4,5].map(n=>'/assets/audio/music/star-piano-'+n+'.mp3'));
    } else {
      if(music) await p.waitForFunction(()=>window.scoreNotes.length===5);
      assert.equal(await p.evaluate(()=>window.scoreNotes.length),music?5:0);
    }
    assert.equal(await p.locator('.found [data-act="album"]').count(),0);
    const albumTab=p.getByRole('navigation',{name:'Game pages'}).getByRole('button',{name:'My Album',exact:true});
    for(const width of [390,375,320]) {
      await p.setViewportSize({width,height:568});
      const fits=await albumTab.evaluate(el=>{
        const label=el.querySelector('span'),r=document.createRange();r.selectNodeContents(label);
        const end=document.querySelector('.mast-end').getBoundingClientRect();
        return r.getClientRects().length===1 && el.closest('nav').getBoundingClientRect().right<=end.left+1 && end.right<=innerWidth+1;
      });
      assert(fits,'My Album and the score fit on a '+width+'px phone');
    }
    await albumTab.click();await p.getByRole('heading',{name:'My word album'}).waitFor();
    assert.equal(await albumTab.getAttribute('aria-current'),'page');
    await p.context().close();
  }
}
async function checkSaveFooter() {
  const p=await openGame(before('dog'),'reduce',{viewport:{width:1343,height:760}});
  const footer=p.getByRole('contentinfo');
  const quietSignIn=footer.getByRole('button',{name:'Sign in with Google to save your progress.'});
  const signIn=footer.getByRole('button',{name:'Sign in with Google',exact:true});
  await p.evaluate(async()=>{
    const {cloud}=await import('/cloud.js');
    let changed, signedIn=false;
    cloud.remembered=()=>signedIn;
    cloud.watch=async callback=>{changed=callback;changed(null);};
    cloud.signIn=async()=>{signedIn=true;changed({email:'reader@example.test'});};
    cloud.signOut=async()=>{signedIn=false;changed(null);};
    cloud.load=async()=>null;
    cloud.save=async()=>{};
  });
  await act(p,'discover');
  assert(await quietSignIn.evaluate(b=>b.getBoundingClientRect().top>=innerHeight-1),'The quiet footer stays below the reading screen');
  for(let i=0;i<3;i++) await act(p,'next-sound');
  await act(p,'reveal');
  await footer.getByText('Save your album and open it on any tablet.',{exact:true}).waitFor();
  assert.equal(await footer.getByRole('button').count(),1);
  for(const [width,height] of [[1343,760],[1024,768],[390,740]]) {
    await p.setViewportSize({width,height});
    const gap=await footer.locator('p').evaluate(caption=>caption.getBoundingClientRect().top-document.querySelector('.found').getBoundingClientRect().bottom);
    assert(gap>=12 && gap<=24,'The save prompt sits directly below the rounded card at '+width+'px: '+gap);
    assert.equal(await p.locator('.found [data-act="sign-in"]').count(),0);
  }
  await signIn.click();await signIn.waitFor({state:'hidden'});
  await act(p,'parents');await act(p,'sign-out');await act(p,'dismiss');
  await signIn.waitFor({state:'visible'});
  assert((await saved(p)).cards.dog,'Signing out keeps the local album');
  await act(p,'album');await quietSignIn.waitFor({state:'visible'});
  await p.context().close();
}
async function checkLandscapeRewards() {
  const album=before('ship');
  album.settings.sparkles=true;
  album.show={tasks:8,picks:['rainbow','music','stars','flowers']};
  const p=await openGame(album,'no-preference',{viewport:{width:1024,height:640},hasTouch:true});
  await observeScoreAudio(p);
  await act(p,'discover');
  await p.evaluate(()=>document.fonts.ready);
  async function fits(locator) {
    const controls=await locator.all();
    assert(controls.length,'expected a visible control');
    for(const el of controls) {
      const box=await el.evaluate(node=>{
        const b=node.getBoundingClientRect(), v=visualViewport;
        return {left:b.left-v.offsetLeft,top:b.top-v.offsetTop,right:b.right-v.offsetLeft,bottom:b.bottom-v.offsetTop,
          width:b.width,height:b.height,screenWidth:v.width,screenHeight:v.height};
      });
      const label=await el.getAttribute('aria-label') || await el.textContent();
      assert(box.width>0 && box.height>0 && box.left>=0 && box.top>=0 && box.right<=box.screenWidth+1 && box.bottom<=box.screenHeight+1,
        label+' '+JSON.stringify(box));
    }
  }
  async function resize(width,height) {
    await p.setViewportSize({width,height});
    await p.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  }
  await act(p,'next-sound');
  for(const [width,height] of [[1024,600],[1133,650],[1180,700],[1280,720],[844,390]]) {
    await resize(width,height);
    await fits(p.locator('#inkpad, [data-act="previous-sound"], [data-act="next-sound"]'));
  }
  await act(p,'previous-sound');
  await resize(1024,640);
  for(let i=0;i<3;i++) await act(p,'next-sound');
  await p.getByRole('button',{name:'Say my word!',exact:true}).click();
  await fits(p.locator('[data-act="reveal"]'));
  // Hold the artwork beyond the nominal show duration. The choice must wait for the actual end.
  let releaseArt;
  const gate=new Promise(resolve=>{releaseArt=resolve;});
  await p.route('**/assets/flower-studies/poppy-1.json',async route=>{await gate;await route.fallback();});
  const requested=p.waitForRequest('**/assets/flower-studies/poppy-1.json');
  await p.clock.install();
  await act(p,'reveal');await requested;
  const picker=p.getByRole('dialog',{name:'You earned a sticker!'});
  await p.clock.fastForward(25000);
  assert.equal(await picker.isVisible(),false);
  assert.equal(await p.evaluate(()=>scrollY),0);
  releaseArt();
  await p.locator('.found.show-playing').waitFor();
  assert.equal(await picker.isVisible(),false);
  await picker.waitFor({timeout:20000});
  const notes=await p.evaluate(()=>window.scoreNotes);
  assert.deepEqual(notes.map(n=>n.score),[1,2,3,4,5].map(i=>album.stars+i));
  assert(notes.every((n,i)=>n.hz>0 && (i===0 || n.hz>notes[i-1].hz)),JSON.stringify(notes));
  assert.equal(await p.locator('.fireworks-screen').count(),0);
  assert.equal(await p.evaluate(()=>scrollY),0);
  await fits(picker.locator('button'));
  await resize(768,1024);await fits(picker.locator('button'));
  await resize(1024,640);await fits(picker.locator('button'));
  const earned=await saved(p);
  await p.keyboard.press('Escape');
  const reopen=p.getByRole('button',{name:'My Stickers',exact:true});
  await reopen.and(p.locator(':focus')).waitFor();
  await fits(reopen);
  await fits(p.getByRole('button',{name:'Next word!',exact:true}));
  assert.deepEqual(await saved(p),earned);
  await act(p,'encore');await act(p,'album');
  await p.clock.fastForward(25000);
  assert.equal(await picker.isVisible(),false,'leaving a celebration cancels its pending choice');
  await p.context().close();
}
try {
  await checkWritingBack();
  await checkLaptopReward();
  await checkSaveFooter();
  await checkCelebrationSize();
  await checkMixedMeadow();
  await checkLandscapeRewards();
  const fresh=await openGame();
  await act(fresh,'album');await act(fresh,'stickers');
  await fresh.getByRole('heading',{name:'Your first sticker goes here'}).waitFor();
  assert.equal(await fresh.locator('.gallery-card').count(),0);
  await fresh.getByRole('button',{name:'Back to my word album'}).click();
  await act(fresh,'discover');await traceAndBlend(fresh,'cat');
  const picker=fresh.getByRole('dialog',{name:'You earned a sticker!'});
  await picker.getByRole('button',{name:'Later'}).click();
  assert.deepEqual((await saved(fresh)).show.picks,[]);
  const starter=fresh.getByRole('button',{name:'Level 1, view Oak keepsakes badge 1'});
  assert((await starter.locator('img').getAttribute('src')).endsWith('/oak-1.webp'));
  await fresh.locator('.badge-award img').evaluate(im=>im.decode());
  await fresh.locator('summary.stars').click();
  const firstMeter=fresh.getByRole('progressbar',{name:'Progress to badge 2'});
  assert.deepEqual(await firstMeter.evaluate(meter=>[meter.value,meter.max]),[1,3]);
  await fresh.keyboard.press('Escape');
  const actions=fresh.locator('.found>.actions>button');
  const actionPositions=()=>actions.evaluateAll(buttons=>buttons.map(el=>{
    const {x,y,width,height}=el.getBoundingClientRect();return [el.textContent.trim(),x,y,width,height];
  }));
  const originalActions=await actionPositions();
  assert.equal(originalActions.length,3);
  await act(fresh,'reward-stickers');
  await picker.locator('.show-pick[data-pick="rainbow"]').click();
  const chosen=fresh.getByRole('heading',{name:'You picked Rainbow · Level 1!',exact:true,level:1});
  await chosen.and(fresh.locator(':focus')).waitFor();
  assert.equal(await chosen.locator('.sticker-confirmation>span').evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.deepEqual(await actionPositions(),originalActions,'choosing a sticker keeps every reward button in place');
  const earned=await saved(fresh);
  await act(fresh,'reward-stickers');await fresh.reload();
  await fresh.getByRole('heading',{name:'My Stickers',exact:true}).waitFor();
  assert.equal(await fresh.locator('#shelf').isVisible(),false);
  assert.deepEqual(await fresh.locator('.gallery-card').evaluateAll(cards=>cards.map(c=>c.dataset.id)),['rainbow']);
  const rainbow=fresh.getByRole('button',{name:/^Play Rainbow/});
  await rainbow.click();
  await fresh.waitForFunction(()=>{
    const canvas=document.querySelector('.gallery-card.is-playing canvas');
    return canvas && canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some((v,i)=>i%4===3 && v);
  });
  await rainbow.waitFor();
  await rainbow.press('Enter');
  await fresh.getByRole('button',{name:/^Stop Rainbow/}).click();
  assert.deepEqual(await saved(fresh),earned,'sticker replays never earn or spend anything');
  await fresh.context().close();
  const original=STAGES[0].entries.map(e=>e.word), ink=[[[20,25],[60,65]]];
  const seed={version:1,stars:55,settings:{sounds:[...new Set(original.join(''))].sort().join(''),voice:false,memoryFirst:false},
    cards:Object.fromEntries(original.slice(0,-1).map(w=>[w,{found:1,box:3,due:Date.now()+1e9,reviews:1,ink:[ink,[],[]]}])),
    lesson:{word:'pig',i:1,ink:[ink,[],[]],help:false},scene:[{word:'cat',x:30,y:42}]};
  const p=await openGame(seed,'no-preference');
  await act(p,'album');await p.locator('[data-act=card][data-word=cat]').click();
  await picture(p,'cat','.card-dialog');await p.locator('.card-dialog .handwritten').waitFor();await act(p,'dismiss');
  await act(p,'home');await act(p,'discover');await traceAndBlend(p,'pig',1);
  await p.getByText(/Stage 2 is open!/).waitFor();
  const graduation=p.locator('.badge-award img');
  assert.deepEqual(await graduation.evaluateAll(async images=>{
    await Promise.all(images.map(im=>im.decode()));
    return images.map(im=>new URL(im.src).pathname.split('/').at(-1));
  }),['oak-5.webp','poppy-1.webp']);
  const handoff=p.getByRole('button',{name:'Stage 2 is open! View Poppy ribbons progress'});
  const stars=p.locator('summary.stars');
  await handoff.locator('strong').click();
  await p.locator('.badge-menu[open] .badge-pocket').getByRole('heading',{name:'Poppy ribbons'}).waitFor();
  await stars.and(p.locator(':focus')).waitFor();
  assert.deepEqual(await p.getByRole('progressbar',{name:'Progress to badge 2'}).evaluate(meter=>[meter.value,meter.max]),[0,2]);
  await p.keyboard.press('Escape');
  await handoff.focus();await p.keyboard.press('Enter');
  assert(await p.locator('.badge-menu').evaluate(menu=>menu.open && menu.querySelector('summary').getBoundingClientRect().top>=-1));
  await p.keyboard.press('Escape');
  await act(p,'parents');await p.locator('[data-class-sound=sh]').uncheck();await act(p,'dismiss');
  await act(p,'album');
  const oldStage=p.locator('.album-stage').first();
  await oldStage.locator('summary').click();
  const oldBadge=oldStage.getByRole('button',{name:'Oak keepsakes, badge 5 of 5'});
  await oldBadge.click();
  await p.locator('.badge-inspect img').evaluate(im=>im.decode());
  await act(p,'dismiss');
  await oldBadge.and(p.locator(':focus')).waitFor();
  await p.locator('[data-act=stage-discover][data-stage="2"]').click();
  await p.locator('.copy-word[aria-label=chip]').waitFor();
  await act(p,'parents');await p.locator('[data-class-sound=sh]').check();await act(p,'dismiss');
  await act(p,'album');await p.locator('.album-stage[open] [data-act=stage-discover]').click();
  await p.locator('.copy-word[aria-label=ship]').waitFor();
  await act(p,'letter-help');await p.waitForFunction(()=>window.played.includes('/assets/audio/letters/sh.mp3'));
  await traceAndBlend(p,'ship');
  await p.waitForFunction(()=>window.played.includes('/assets/audio/words/ship.mp3'));
  const played=await p.evaluate(()=>window.played);
  const finale=played.slice(played.lastIndexOf('/assets/audio/blends/ship.mp3')+1).filter(path=>path.includes('/letters/'));
  assert.deepEqual(finale,['sh','i','p'].map(c=>'/assets/audio/letters/'+c+'.mp3'));
  await p.reload();await picture(p,'ship','.reveal-art');
  assert.deepEqual((await saved(p)).cards.cat.ink[0],ink);
  await p.clock.setFixedTime(new Date(Date.now()+180000));
  await act(p,'review');await act(p,'start-round');
  let reviewedShip=false;
  while(await p.locator('.face-down').count()) {
    const word=await p.locator('.face-down .word-print').getAttribute('aria-label');
    assert.equal(await p.locator('.picture-pick').count(),0);
    if(word==='ship'){
      if(!await p.locator('[data-letter=sh]').isVisible())await act(p,'shelf');
      await p.locator('[data-letter=sh]').click();reviewedShip=true;
    }
    await act(p,'flip');await picture(p,word,'.picture-picks');
    if(word==='ship'){
      await p.locator('[data-act=pick]:not([data-word=ship])').first().click();
      await p.waitForFunction(()=>window.played.includes('/assets/audio/blends/ship.mp3'));
    }
    await p.locator('[data-act=pick][data-word="'+word+'"]').click();await act(p,'next-card');
  }
  await p.getByRole('heading',{name:'Round complete!'}).waitFor();
  assert(reviewedShip);assert.equal((await saved(p)).sounds.sh.wrong,1);
  await p.getByRole('dialog',{name:'You earned a sticker!'}).locator('[data-pick="music"]').click({timeout:20000});
  const pickedMusic=p.getByRole('heading',{name:'You picked Music!',exact:true,level:1});
  await pickedMusic.waitFor();
  assert.equal(await pickedMusic.locator('.sticker-confirmation>span').evaluate(el=>getComputedStyle(el).animationName),'sticker-picked');
  await act(p,'album');await act(p,'stickers');
  await p.getByRole('button',{name:'Play Music',exact:true}).waitFor();
  await act(p,'album');await p.locator('.album-stage[open] [data-act=stage-bonus]').click();
  await traceAndBlend(p,'shop');await p.getByText('Bonus find',{exact:true}).waitFor();
  await p.context().close();
  for(const w of ['cake','strawberry']) {
    const later=await openGame(before(w));await act(later,'discover');await traceAndBlend(later,w);
    await later.reload();await picture(later,w,'.reveal-art');await act(later,'album');
    await later.locator('[data-act=card][data-word="'+w+'"]').click();
    await picture(later,w,'.card-dialog');await later.context().close();
  }
  assert.deepEqual(errors,[]);
  console.log('Chromium passed word and memory sticker awards, album replay, reading and writing, stage and badge progression, sound shelf and bonus words.');
} finally {await browser.close();}
