import {SHOW,SHOW_GROUPS} from './game.js';
import {finaleScenery,launchFinale,prepareShow} from './finale.js';

const get=id=>document.getElementById(id);
const picker=get('picker'), scene=get('scene'), meadow=get('word-stage'), outline=get('outline');
const timeline=get('timeline'), playButton=get('play'), soundButton=get('sound'), status=get('load-status');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const word='hat', finds=['hat','cat','dog','hen'];
const core=[{id:'comet',name:'Shooting star'},{id:'tally',name:'Earned stars'},{id:'rosette',name:'Stage badge'}];
const byId=new Map([...SHOW,...core].map(effect=>[effect.id,effect]));
const groups=[SHOW_GROUPS.find(([name])=>name==='Visitors'),...SHOW_GROUPS.filter(([name])=>name!=='Visitors'),
  ['Word reveal',core.map(effect=>effect.id)]];
for(const [name,ids] of groups) {
  const group=document.createElement('optgroup');group.label=name;
  for(const id of ids) group.append(new Option(byId.get(id).name,id));
  picker.append(group);
}
const ids=Array.from(picker.options,option=>option.value);
const wholeScreen=new Set(core.map(effect=>effect.id));
const sample=document.createElement('canvas');
const sampleCtx=sample.getContext('2d',{willReadFrequently:true});
const fanfare=new Audio('./assets/audio/music/fanfare.mp3');fanfare.preload='none';
let current,show,ready=false,playing=false,raf=0,selected=0,playhead=0,started=0,lastMeasured=0,soundOn=false;

// Sample the transparent effects layer. Empty camera margins, the background
// word card and UI controls never contribute to the reported artwork size.
function canvasBounds(canvas) {
  if(!canvas || Number(canvas.style.opacity || 1)<.04) return null;
  const rect=canvas.getBoundingClientRect();
  if(!rect.width || !rect.height) return null;
  const scale=Math.min(1,560/rect.width,340/rect.height);
  const width=Math.max(1,Math.ceil(rect.width*scale)),height=Math.max(1,Math.ceil(rect.height*scale));
  if(sample.width!==width || sample.height!==height) {sample.width=width;sample.height=height;}
  sampleCtx.clearRect(0,0,width,height);sampleCtx.drawImage(canvas,0,0,width,height);
  const data=sampleCtx.getImageData(0,0,width,height).data;
  let left=width,right=-1,top=height,bottom=-1;
  for(let y=0;y<height;y++) {
    let first=width,last=-1;
    for(let x=0,i=(y*width)*4+3;x<width;x++,i+=4) {
      if(data[i]<15) continue;
      if(first===width) first=x;
      last=x;
    }
    if(last<0) continue;
    left=Math.min(left,first);right=Math.max(right,last);top=Math.min(top,y);bottom=y;
  }
  if(right<left) return null;
  const dx=rect.width/width,dy=rect.height/height;
  return {left:rect.left+left*dx,top:rect.top+top*dy,width:(right-left+1)*dx,height:(bottom-top+1)*dy};
}
function measure() {
  const guide=get('bounds'), arch=meadow.querySelector('[data-meadow-rainbow="'+current+'"]');
  const box=arch ? arch.getBoundingClientRect() : canvasBounds(document.querySelector(wholeScreen.has(current)?'.fireworks-screen':'.show-floor'));
  get('size-label').textContent=arch?'Full arch extent':'Visible artwork';
  get('viewport').textContent=Math.round(innerWidth)+' × '+Math.round(innerHeight)+' viewport';
  guide.hidden=!outline.checked || !box;
  if(!box) {
    get('size').textContent=get('left').textContent=get('bottom').textContent='—';
    return;
  }
  const {left,top,width,height}=box;
  get('size').textContent='≈ '+Math.round(width)+' × '+Math.round(height)+' px';
  get('left').textContent=Math.round(left)+' px';
  get('bottom').textContent=Math.round(innerHeight-top-height)+' px';
  if(!guide.hidden) Object.assign(guide.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px'});
}
function duration() {
  return current==='music' && soundOn && Number.isFinite(fanfare.duration) ? Math.max(show.total,fanfare.duration) : show.total;
}
function draw(time,force=false,rewind=false) {
  playhead=Math.max(0,Math.min(time,duration()));
  show.seek(playhead,rewind);
  timeline.max=duration().toFixed(2);timeline.value=playhead.toFixed(2);
  const label=playhead.toFixed(1)+' / '+duration().toFixed(1)+' s';
  get('clock').value=label;timeline.setAttribute('aria-valuetext',label);
  const now=performance.now();
  if(force || now-lastMeasured>=130) {measure();lastMeasured=now;}
}
function pause() {
  cancelAnimationFrame(raf);playing=false;fanfare.pause();
  playButton.textContent='Play';
}
function syncMusic() {
  if(current!=='music' || !soundOn) return;
  if(Number.isFinite(fanfare.duration) && playhead>=fanfare.duration) return;
  fanfare.currentTime=playhead;
  fanfare.play().catch(()=>{soundOn=false;soundButton.textContent='Sound off';soundButton.setAttribute('aria-pressed','false');});
}
function play(from=playhead) {
  if(!ready) return;
  pause();playing=true;playButton.textContent='Pause';
  draw(from,true);started=performance.now()-from*1000;syncMusic();
  function tick(now) {
    const time=(now-started)/1000;
    if(time>=duration()) {
      pause();draw(show.posterTime,true,true);playButton.textContent='Replay';return;
    }
    draw(time);raf=requestAnimationFrame(tick);
  }
  raf=requestAnimationFrame(tick);
}
async function selectEffect(id,auto=true) {
  const turn=++selected;
  pause();show?.stop();ready=false;current=id;
  picker.value=id;get('counter').textContent=(ids.indexOf(id)+1)+' of '+ids.length;
  history.replaceState(null,'','#'+id);
  timeline.value='0';timeline.disabled=playButton.disabled=true;
  get('bounds').hidden=true;get('size').textContent=get('left').textContent=get('bottom').textContent='—';
  status.textContent='Loading artwork…';
  soundButton.hidden=id!=='music';fanfare.pause();
  const picks=id==='splash'?['whale',id]:id==='hats'?['bunnies',id]:[id];
  meadow.querySelector('.meadow-scenery')?.remove();
  meadow.insertAdjacentHTML('afterbegin',finaleScenery(picks,id));
  try {
    if(id==='hats') await prepareShow(['hat']);
    if(turn!==selected) return;
    const next=launchFinale(scene,{alone:id,picks,finds,word,spell:false,review:true,
      stars:id==='tally'?5:0,tier:id==='rosette'?1:0,badgeSrc:id==='rosette'?'./assets/badges/oak-1.webp':''});
    if(!next) throw Error('Canvas unavailable');
    show=next;await next.ready;
    if(turn!==selected) return;
    ready=true;status.textContent='';timeline.disabled=playButton.disabled=false;
    if(auto && !reducedMotion.matches && !document.hidden) play(0);
    else {draw(next.posterTime,true,true);playButton.textContent='Replay';}
  } catch {
    if(turn!==selected) return;
    show?.stop();status.textContent='This animation could not load.';playButton.disabled=false;playButton.textContent='Retry';
  }
}
function step(n) {selectEffect(ids[(ids.indexOf(current)+n+ids.length)%ids.length]);}
get('previous').addEventListener('click',()=>step(-1));
get('next').addEventListener('click',()=>step(1));
meadow.querySelector('.before').addEventListener('click',()=>step(-1));
meadow.querySelector('.after').addEventListener('click',()=>step(1));
picker.addEventListener('change',()=>selectEffect(picker.value));
playButton.addEventListener('click',()=>{
  if(!ready) selectEffect(current);
  else if(playing) {pause();draw(playhead,true);}
  else play(playButton.textContent==='Replay' || playhead>=duration()?0:playhead);
});
timeline.addEventListener('input',()=>{if(ready){pause();draw(Number(timeline.value),true);}});
outline.addEventListener('change',()=>{if(ready) measure();});
soundButton.addEventListener('click',()=>{
  soundOn=!soundOn;soundButton.textContent=soundOn?'Sound on':'Sound off';soundButton.setAttribute('aria-pressed',String(soundOn));
  if(!soundOn) fanfare.pause();
  else if(playing) syncMusic();
  else play(0);
});
document.addEventListener('keydown',event=>{
  if(event.altKey || event.ctrlKey || event.metaKey || event.target.matches('select,input[type=range]')) return;
  if(event.key==='ArrowLeft' || event.key==='ArrowRight') {event.preventDefault();step(event.key==='ArrowLeft'?-1:1);}
});
let layoutFrame=0;
function updateLayout() {
  cancelAnimationFrame(layoutFrame);
  layoutFrame=requestAnimationFrame(()=>{if(ready) draw(playhead,true,true);});
}
window.addEventListener('resize',updateLayout);
window.addEventListener('scroll',updateLayout,{passive:true});
window.addEventListener('hashchange',()=>selectEffect(ids.includes(location.hash.slice(1))?location.hash.slice(1):'bunnies'));
document.addEventListener('visibilitychange',()=>{if(document.hidden && playing) pause();});
reducedMotion.addEventListener('change',()=>{if(ready && reducedMotion.matches){pause();draw(show.posterTime,true,true);}});
selectEffect(ids.includes(location.hash.slice(1))?location.hash.slice(1):'bunnies');
