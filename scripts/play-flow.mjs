// Exercise the shipped Worker in Chromium. Its public R2 artwork is supplied by
// the matching local files; no account, remote storage or speech service is used.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import worker from '../dist/server/index.js';
import {KEY,STAGES,unitsOf,newProfile,findNext,startLesson,collect} from '../dist/game.js';

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
      constructor(...args){super(...args);this.addEventListener('playing',()=>window.played.push(new URL(this.currentSrc).pathname));}
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
async function traceAndBlend(p,word,first=0) {
  await p.locator('.copy-word[aria-label="'+word+'"]').waitFor();
  for(let i=first;i<word.length;i++){
    const pos=unitsOf(word).findIndex(u=>u.positions.includes(i));
    assert.equal(await p.locator('.copy-word .current').count(),unitsOf(word)[pos].positions.length);
    const pad=p.locator('#inkpad');await pad.scrollIntoViewIfNeeded();
    const b=await pad.boundingBox();assert(b.width>70,'writing pad remains usable on a phone');
    await p.mouse.move(b.x+b.width*.4,b.y+b.height*.3);await p.mouse.down();
    await p.mouse.move(b.x+b.width*.6,b.y+b.height*.65,{steps:4});await p.mouse.up();
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
  async function measure(id,expected) {
    await page.waitForFunction(()=>window.shotDraws.length>0);
    const result=await page.evaluate(()=>{
      const floor=document.querySelector('.show-floor'), box=floor.getBoundingClientRect();
      return {draws:window.shotDraws,top:box.top,bottom:box.bottom,height:box.height,h:innerHeight,
        pixels:floor.height,cssWidth:box.width,width:floor.width,dpr:devicePixelRatio};
    });
    assert(Math.abs(result.bottom-result.h)<1 && result.height<=result.h*.28+1,id+' stays in the bottom strip');
    assert.equal(result.width,Math.round(result.cssWidth*result.dpr));
    assert.equal(result.pixels,Math.round(result.height*result.dpr));
    for(const {layer,scaleX,scaleY} of result.draws) {
      assert.equal(layer,'show-floor',id);
      assert(Math.abs(scaleX-scaleY)<.0001 && scaleX>0 && scaleX<=1.0001,id+' preserves native proportions and resolution');
      if(expected!==undefined) assert(Math.abs(scaleX-expected)<.001,id+' uses native pixels when it fits');
    }
    return result;
  }
  await act(page,'parents');await act(page,'trial');
  await page.locator('[data-act="trial-one"][data-pick="bunnies"]').tap();
  await measure('Grown-ups bunny',1);
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
  await page.context().close();
}
try {
  await checkCelebrationSize();
  const fresh=await openGame();await act(fresh,'discover');await traceAndBlend(fresh,'cat');
  const starter=fresh.getByRole('button',{name:'Level 1, view Oak keepsakes badge 1'});
  assert((await starter.locator('img').getAttribute('src')).endsWith('/oak-1.webp'));
  await fresh.locator('.badge-award img').evaluate(im=>im.decode());
  await fresh.locator('summary.stars').click();
  const firstMeter=fresh.getByRole('progressbar',{name:'Progress to badge 2'});
  assert.deepEqual(await firstMeter.evaluate(meter=>[meter.value,meter.max]),[1,3]);
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
  await p.locator('summary.stars').click();
  await p.locator('.badge-pocket').getByRole('heading',{name:'Poppy ribbons'}).waitFor();
  assert.deepEqual(await p.getByRole('progressbar',{name:'Progress to badge 2'}).evaluate(meter=>[meter.value,meter.max]),[0,2]);
  await p.keyboard.press('Escape');
  await act(p,'parents');await p.locator('[data-class-sound=sh]').uncheck();await act(p,'dismiss');
  await act(p,'album');
  const oldStage=p.locator('.album-stage').first();
  await oldStage.locator('summary').click();
  const oldBadge=oldStage.getByRole('button',{name:'Oak keepsakes, badge 5 of 5'});
  await oldBadge.click();
  await p.locator('.badge-inspect img').evaluate(im=>im.decode());
  await act(p,'dismiss');
  await oldBadge.waitFor();
  assert(await oldBadge.evaluate(el=>el===document.activeElement));
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
  console.log('Chromium: fresh cat; v1 ink + resumed pig; class filtering; ship unlock, sound shelf, finale and memory; bonus shop; cake and strawberry through tracing, blending, reveal and album.');
} finally {await browser.close();}
