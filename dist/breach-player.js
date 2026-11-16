import {concepts,seconds,paint} from './breach-references.js';
const list=document.querySelector('#studies');
const speed=document.querySelector('#speed');
let stopActive=null;
document.querySelector('#surface').onchange=e=>list.className='studies '+e.target.value;
for(const study of concepts){
  const card=document.createElement('article');
  card.className='study';
  card.innerHTML=`<canvas class="stage" role="img" aria-label="${study.name} illustration"></canvas><div class="controls"><button type="button">▶ Play</button><input type="range" aria-label="Scrub ${study.name}" min="0" step=".001"><output></output></div><h2>${study.name}</h2><p class="description">${study.description}</p><a class="source" href="${study.url}" target="_blank" rel="noopener">${study.source} ↗</a>`;
  list.append(card);
  const cv=card.querySelector('canvas'),ctx=cv.getContext('2d'),btn=card.querySelector('button'),slider=card.querySelector('input'),clock=card.querySelector('output');
  const length=seconds(study);
  let t=(study.poster-study.poses[0][0])/study.speed, raf=0, last=0, fromPoster=true;
  slider.max=length;
  function render(){
    const w=Math.max(1,Math.round(cv.clientWidth*Math.min(2,devicePixelRatio||1))),h=Math.round(w*315/600);
    if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
    ctx.setTransform(w/600,0,0,h/315,0,0);ctx.clearRect(0,0,600,315);paint(ctx,study,t);
    slider.value=t;clock.value=t.toFixed(2)+' s';slider.setAttribute('aria-valuetext',t.toFixed(2)+' seconds');
  }
  function pause(){
    cancelAnimationFrame(raf);raf=0;btn.textContent='▶ Play';btn.setAttribute('aria-label','Play '+study.name);
    if(stopActive===pause)stopActive=null;
  }
  function tick(now){
    const rate=speed.value==='source'?1/study.speed:Number(speed.value);
    t=Math.min(length,t+(now-last)*rate/1000);last=now;render();
    if(t>=length){pause();return}
    raf=requestAnimationFrame(tick);
  }
  btn.onclick=()=>{
    if(raf){pause();return}
    stopActive?.();if(fromPoster||t>=length)t=0;
    fromPoster=false;stopActive=pause;btn.textContent='Ⅱ Pause';btn.setAttribute('aria-label','Pause '+study.name);
    last=performance.now();render();raf=requestAnimationFrame(tick);
  };
  slider.oninput=()=>{stopActive?.();fromPoster=false;t=Number(slider.value);render()};
  pause();new ResizeObserver(render).observe(cv);render();
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopActive?.()});
window.addEventListener('pagehide',()=>stopActive?.());
