import {stage,levels,duration,drawOrca} from './ember-orca.js';
import {drawStar,four,five} from './show-kit.js';
const el=id=>document.getElementById(id);
const canvas=el('orca'), stars=el('stars'), slider=el('time'), play=el('play');
const captions=['A fast launch and a soft landing.','A higher arc with a flank flash and twin sprays.','One full somersault into a tall crown of foam.'];
let level=1,time=.36,frame=0,start=0;
function context(cv){
 const ratio=Math.min(2,window.devicePixelRatio||1);
 const w=Math.max(1,Math.round(cv.clientWidth*ratio)),h=Math.max(1,Math.round(cv.clientHeight*ratio));
 if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
 const ctx=cv.getContext('2d');ctx.setTransform(w/stage.width,0,0,h/stage.height,0,0);
 ctx.clearRect(0,0,stage.width,stage.height);return ctx;
}
function draw(){
 const c=context(canvas);drawOrca(c,level,time);
 const b=context(stars);
 if(el('layer').checked){
   for(let i=0;i<30;i++){
     const x=(i*173+39)%640+6*Math.sin(time*1.9+i), y=(i*97+17)%325-10*Math.sin(time*2+i*.8);
     drawStar(b,x,y,3+(i%4)*2,i*.4+time*.4,i%3?four:five,i%2?'#eac16d':'#9bab8f');
   }
 }
 slider.max=duration(level).toFixed(2);slider.value=time;
 el('clock').textContent=time.toFixed(2)+' / '+duration(level).toFixed(2)+' s';
 slider.setAttribute('aria-valuetext',time.toFixed(2)+' seconds');
}
function pause(){cancelAnimationFrame(frame);frame=0;play.textContent='▶ Play'}
function tick(now){
 time=Math.min(duration(level),(now-start)/1000);draw();
 if(time>=duration(level))pause();else frame=requestAnimationFrame(tick);
}
function run(from=0){
 pause();start=performance.now()-from*1000;time=from;play.textContent='Ⅱ Pause';draw();frame=requestAnimationFrame(tick);
}
const choices=el('choices');
levels.forEach((s,i)=>{
 const n=i+1,button=document.createElement('button');button.type='button';button.className='choice';
 button.innerHTML=`<canvas class="thumb" aria-hidden="true"></canvas><span><small>Level ${n}</small><strong>${s.name}</strong><span>${captions[i]}</span></span>`;
 button.setAttribute('aria-pressed',String(n===level));choices.append(button);
 function poster(){
   const cv=button.querySelector('canvas'),c=context(cv);
   const q=[.44,.53,.50][i];
   const x=320+s.travel*(q-.5), y=stage.surface+(132+66*q)*s.scale-4*s.rise*q*(1-q);
   const k=Math.min(cv.width/245,cv.height/180);
   c.save();c.setTransform(k,0,0,k,cv.width/2-k*x,cv.height/2-k*y);
   drawOrca(c,n,s.air*q);c.restore();
 }
 new ResizeObserver(poster).observe(button.querySelector('canvas'));
 button.addEventListener('click',()=>{
   level=n;for(const other of choices.children)other.setAttribute('aria-pressed',String(other===button));
   run();
 });
});
let inspected=false;
play.addEventListener('click',()=>{
 if(frame){pause();inspected=true;return}
 run(inspected&&time<duration(level)?time:0);inspected=false;
});
slider.addEventListener('input',()=>{pause();time=Number(slider.value);inspected=true;draw()});
el('surface').addEventListener('change',e=>el('stage').dataset.surface=e.target.value);
el('layer').addEventListener('change',draw);
new ResizeObserver(draw).observe(canvas);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&frame){pause();inspected=true}});
window.addEventListener('pagehide',pause);draw();
