import {cutout,prepareShow} from './show-cutouts.js';
import {colours,gold,ink,cream,water,tau,clamp01,ease,easeIn,pop,bump,five,four,drawStar,paint,oval,flower,random} from './show-kit.js';
import {SCENES} from './show-scenes.js';
import {CREATURES} from './show-creatures.js';
import {orcas} from './ember-breach.js';
import {dolphinFamilies} from './dolphins.js';
import {dolphins} from './show-dolphins.js';
import {flowerFamilies,flowerShots} from './gardens.js';
import {flowers} from './show-flowers.js';
import {highestWoodland} from './woodland.js';
import {woodlandParts,paradeWords} from './show-woodland.js';
import {archBox,highestPrism,prismByFamily} from './prism.js';
import {prismParts} from './show-prism.js';

// The celebration show. Her letter sounds play, the star reveals her picture,
// and the things she has added take turns after that. Her stars are counted out at the end.
const GROUND=['mushrooms','vines','oak'], SKY=['stars','fountains','blooms','paint'];
// Only two visitors and two big finishes play in one show, in rotation, so a full show stays near a quarter of a minute.
const VISIT=['bunnies','parade','dolphins','elephants'], FINISH=['fireflies','picture','whale'];
let stopActive=null;
const waitingForArtwork=new WeakMap();

// A printed theatre stays on the page after the show and in reduced motion. The rainbows appear once she has added them.
function finaleScenery(picks=[]) {
  const poppy=flowerShots.findLast(shot=>shot.family==='poppy' && picks.includes(shot.id));
  const arches=['rainbow','rainbow2'].map(key=>highestPrism(key,id=>picks.includes(id))).filter(Boolean);
  const stills=arches.map(shot=>{
    const [x,y,w,h]=archBox;
    const bands=['#c98c75','#dbb177','#d5c78d','#a0b79b','#96aaa9','#aca4ba'].map((colour,i)=>
      `<path d="M${86+i*8} 245 A${324-i*8} ${203-i*8} 0 0 1 ${734-i*8} 245" stroke="${colour}"/>`).join('');
    return `<svg x="${820*x}" y="${270*y}" width="${820*w}" height="${270*h}" viewBox="0 0 820 270" preserveAspectRatio="none">
      <g class="meadow-arch" fill="none" stroke-width="8.5">${bands}</g>
      <image href="${shot.still}" width="820" height="270" preserveAspectRatio="none"/>
    </svg>`;
  }).join('');
  return `<div class="meadow-scenery" aria-hidden="true"><svg class="rainbow-theatre" viewBox="0 0 820 270" preserveAspectRatio="none">
    <defs><linearGradient id="show-sky" x2="0" y2="1" gradientUnits="objectBoundingBox">
      <stop stop-color="#dce9e1"/><stop offset=".66" stop-color="#f6f2de"/><stop offset="1" stop-color="#f9edd2"/>
    </linearGradient></defs>
    <rect width="820" height="270" fill="url(#show-sky)"/>
    <circle cx="114" cy="62" r="23" fill="#f3daa4"/>
    <path d="M59 81q15-5 30-3 12-10 29-6 11-3 20 2 18 0 27 5-57 4-106 2Z M664 60q15-5 28-4 12-8 24-5 12-1 21 4l20 3q-46 4-93 2Z" fill="#fff9e9"/>
    <path d="M0 178Q82 150 149 175T308 210Q376 216 449 202T605 184Q695 172 820 133V270H0Z" fill="#d4ddc6"/>
    <path d="M0 203Q95 164 203 198T405 232Q504 229 618 199T820 184V270H0Z" fill="#b9cbb0"/>
    <g class="prism-stills">${stills}</g>
    <path d="M0 212Q82 210 169 233T387 260Q511 263 643 233T820 211V270H0Z" fill="#96b19a"/>
    <g fill="none" stroke="#627e6d" stroke-width="1.5" stroke-linecap="round">
      <path d="M24 238q23-2 43 3m-14 4 12 1m63 3 28 6m525-9 26-5m59-13 24-4"/>
      <path d="M79 237q-2-12-8-18m8 18q0-17 6-26m-6 26q4-9 9-12m648 10q-2-13-7-19m7 19q1-15 6-22"/>
    </g>
  </svg><div class="meadow-poppy">${poppy?`<img src="${poppy.still}" alt="">`:''}</div></div>`;
}

// The parts that belong to every show.
const BASE={
  // Sound out the word while the learner's handwriting stays in place.
  letters:{len:99,z:9,
    make() {return {spoken:0};},
    step(e,s,t) {
      while(s.spoken<e.word.length && t>=s.spoken*.5) e.on('onLetter',s.spoken++);
    }},
  // Each star she earned pops out of her picture and flies up to her total.
  tally:{len:99,z:9,
    make() {return {landed:0};},
    step(e,s,t) {
      const to=e.starHome || {x:e.w-44,y:34};
      while(s.landed<e.stars && t>=s.landed*.22+.83){s.landed++;e.ring(to.x,to.y,34*e.u);e.on('onStar');}
    },
    draw(e,s,t) {
      const to=e.starHome || {x:e.w-44,y:34};
      for(let i=0;i<e.stars;i++) {
        const a=t-i*.22;
        if(a<0 || a>=.83) continue;
        const rest={x:e.cx+(i-(e.stars-1)/2)*38*e.u,y:e.cy-e.th.h*.36};
        let x,y,size;
        if(a<.38){const g=ease(a/.2);x=e.cx+(rest.x-e.cx)*g;y=e.cy+(rest.y-e.cy)*g;size=18*e.u*pop(a/.22);}
        else {const f=easeIn((a-.38)/.45);x=rest.x+(to.x-rest.x)*f;y=rest.y+(to.y-rest.y)*f-Math.sin(f*Math.PI)*40*e.u;size=18*e.u*(1-f*.45);}
        drawStar(e.ctx,x,y,size,a*5,five,'#ffd752');
      }
    }},
  // A rosette is pinned to the stage when she finishes a collection of three.
  rosette:{len:1.5,stays:true,z:7,
    cues:[[.2,e=>{const p=pin(e);e.burst(p.x,p.y,54,330);}]],
    draw(e,s,t) {
      const ctx=e.ctx, p=pin(e), r=44*e.u, size=t<.2?4-3*ease(t/.2):1+.12*bump((t-.2)/.3);
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-.12+Math.sin(t*2)*.03);ctx.scale(size,size);ctx.globalAlpha=clamp01(t/.12);
      for(const [side,colour] of [[-1,colours[0]],[1,colours[4]]]) {
        ctx.beginPath();ctx.moveTo(side*r*.08,r*.5);ctx.lineTo(side*r*.52,r*2.2);ctx.lineTo(side*r*.78,r*1.86);ctx.lineTo(side*r*1.12,r*2.06);ctx.lineTo(side*r*.62,r*.4);ctx.closePath();
        paint(ctx,colour,2.2);
      }
      ctx.beginPath();
      for(let i=0;i<=84;i++){const a=i/84*tau, q=r*(1+.09*Math.cos(a*14));ctx.lineTo(Math.cos(a)*q,Math.sin(a)*q);}
      ctx.closePath();paint(ctx,gold,2.4);
      ctx.beginPath();ctx.arc(0,0,r*.66,0,tau);paint(ctx,cream,2);
      ctx.fillStyle=ink;ctx.font=`400 ${r*.86}px "Young Serif", Georgia, serif`;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(String(e.tier),0,r*.05);
      ctx.restore();
    }}
};
const pin=e=>({x:e.th.x+e.th.w*.86,y:e.th.y+e.th.h*.27});
const PARTS={...BASE,...SCENES,...CREATURES,...orcas,...dolphins,...flowers,...woodlandParts,...prismParts};

function rotateCast(mine,turn,all) {
  if (all || mine.length<=2) return mine;
  return [mine[turn%mine.length],mine[(turn+1)%mine.length]];
}

// Each family contributes its highest earned jump. Normal shows share one dolphin
// slot; the grown-ups' full rehearsal includes one act from every chosen family.
function visitors(have,turn,all) {
  const jumps=dolphinFamilies.map(family=>family.levels.findLast(shot=>have(shot.id))?.id).filter(Boolean);
  const available=VISIT.map(key=>key==='dolphins' ? (jumps.length && key) : highestWoodland(key,have)).filter(Boolean);
  const cast=rotateCast(available,turn,all);
  const slot=cast.indexOf('dolphins');
  if (slot<0) return cast;
  // In a larger cast dolphins appear twice per rotation. Count their appearances
  // separately so a visitor rotation cannot permanently skip a dolphin family.
  const appearance=available.length<=2 ? turn : 2*Math.floor(turn/available.length)+slot;
  cast.splice(slot,1,...(all ? jumps : [jumps[appearance%jumps.length]]));
  return cast;
}

// Works out when each part of a show starts and how long the whole show runs. `letters` is how many of her letters
// land before the picture, which happens only where her word is on the page, and `staged` says whether the page has the stage.
// Each act is the part's name, its start, its length, and whether it then stays to the end.
function planShow({picks=[],alone='',all=false,turn=0,letters:n=0,staged=false,stars=0,tier=0}={}) {
  const acts=[], have=id=>(id===alone || picks.includes(id)) && PARTS[id];
  const picked=key=>prismByFamily[key] ? highestPrism(key,have)?.id : have(key) && key;
  const blooms=flowerFamilies.map(family=>family.shots.findLast(shot=>have(shot.id))?.id).filter(Boolean);
  const ground=GROUND.map(key=>key==='oak' ? (have(key) && key) : highestWoodland(key,have)).filter(Boolean);
  // Each show uses the highest earned orca in its single ocean-finale slot.
  const whale=['whale3','whale2','whale'].find(have) || 'whale', contact=orcas[whale].contact;
  let end=0, hit=0;
  const add=(id,at,len=PARTS[id].len)=>{
    acts.push([id,at,Math.min(len,30),!!PARTS[id].stays]);
    if(!PARTS[id].stays) end=Math.max(end,at+Math.min(len,30));
    return at;
  };
  if(alone) {
    const friends={music:['notes'],
      splash:[whale,...blooms,...ground],
      hats:[visitors(have,turn,true)[0] || (have(whale)?whale:'bunnies')]}[alone] || [];
    for(const id of friends) add(id,.1);
    if(PARTS[alone]) add(alone,alone==='splash'?.1+contact:friends.length?.6:.1);
    for(const [id,at] of acts) if(PARTS[id].stays) end=Math.max(end,at+PARTS[id].len+.9);
  } else {
    hit=n?.25+n*.5+.3:staged?.95:.74;
    if(n) add('letters',.25,hit+.45);
    add('comet',hit-.72);
    let t=hit+(n?.8:.45);
    blooms.forEach((id,k)=>add(id,hit+.15+k*.18));
    ground.forEach((id,k)=>add(id,hit+.15+(k+Number(blooms.length>0))*.3));
    ['rainbow','rainbow2'].map(picked).filter(Boolean).forEach((id,k)=>add(id,hit+k*.25));
    // Each group starts while the one before it is finishing, so there is always one new thing to watch.
    const sky=SKY.map(picked).filter(Boolean);
    sky.forEach((id,k)=>add(id,t+k*.3));
    if(sky.length) t=Math.max(t,end-1.2);
    const finishes=FINISH.map(id=>id==='whale'?picked(whale):picked(id)).filter(Boolean);
    for(const cast of [visitors(have,turn,all),rotateCast(finishes,turn,all)]) {
      cast.forEach((id,k)=>{
        const at=add(id,t);
        if(id===whale && have('splash')) add('splash',at+contact);
        t=at+PARTS[id].len*(k<cast.length-1?.55:1);
      });
      if(cast.length) t=Math.max(t,end)-.9;
    }
    if(tier){add('rosette',t);t+=1.1;}
    if(stars) add('tally',t,.22*stars+.95);
    else end=Math.max(end,t);
    for (const [id,at,len] of acts) {
      if (id==='oak' || flowers[id] || woodlandParts[id]?.stays || prismParts[id]?.stays) end=Math.max(end,at+len);
    }
  }
  return {acts,hit,total:end+.6};
}
function cancelFinale() {stopActive?.();}

// Plays her show over the page. With `alone` it plays one addition by itself, with `into` it loops in a small
// canvas as a preview. Set `loop` to false for a user-triggered clip, or `freeze` to a time for a still.
function launchFinale(stage,options={}) {
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const {picks=[],finds=[],word='',stars=0,tier=0,turn=0,alone='',all=false,spell=true,freeze=null,into=null,loop=true}=options;
  if(!into) cancelFinale();
  if(!into && freeze===null && (motion.matches || document.hidden)) return null;
  const canvas=into || document.createElement('canvas'), ctx=canvas.getContext('2d');
  if(!ctx) return null;
  const real=!into && stage?.querySelector('.rainbow-theatre') && stage.querySelector('.reveal-art')?stage:null;
  if(!into){canvas.className='fireworks-screen';canvas.setAttribute('aria-hidden','true');document.body.append(canvas);}
  const sparks=[], rings=[];
  let limit=320, frame=0, last=0, states=[], stopped=false;
  function spark(p) {
    sparks.push({age:0,life:1.5,size:6*e.u,rot:0,spin:0,kind:'star5',colour:gold,g:1,drag:.55,vx:0,vy:0,...p});
    if(sparks.length>limit) sparks.splice(0,sparks.length-limit);
  }
  function burst(x,y,n,energy,{sky=false,kind='mix',g=1,drag=.55}={}) {
    rings.push({x,y,age:0,r:energy*.28*e.u});
    for(let i=0;i<n;i++) {
      const angle=i*tau/n+e.rand()*.15, speed=energy*(.35+e.rand()*.68)*e.u, sort=i%6;
      const p={x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-(sky?energy*.52:35)*e.u,life:1.45+e.rand()*1.65,
        rot:e.rand()*tau,spin:e.rand()*5-2.5,g,drag,colour:i%4===0?gold:colours[i%colours.length]};
      if(kind==='flower') Object.assign(p,{kind:i%2?'petal':'flower',size:(i%2?4+e.rand()*3:9+e.rand()*6)*e.u,colour:colours[(i>>1)%7],life:2+e.rand()*1.2,spin:e.rand()*3-1.5});
      else Object.assign(p,{kind:sort===1 || sort===4?'strip':sort===3?'star4':'star5',size:(sort===0?10+e.rand()*10:3+e.rand()*6)*e.u});
      spark(p);
    }
  }
  const e={ctx,w:0,h:0,u:1,cx:0,cy:0,th:null,virtual:!real,word,finds,stars,tier,time:0,total:0,hit:0,soak:0,starHome:null,
    rand:random(1),has:id=>id===alone || picks.includes(id),spark,burst,ring:(x,y,r)=>rings.push({x,y,age:0,r}),cut:cutout,
    // Her hat sits on any creature that asks for one, once she has added hats to her show.
    hat(x,y,angle,size) {
      const c=e.has('hats') && cutout('hat');
      if(!c?.ready) return;
      ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.drawImage(c.canvas,-size/2,-size*.74,size,size);ctx.restore();
    },
    on(name,...a) {if(freeze===null && !into) options[name]?.(...a);}};
  function locate() {
    if(!real) {
      const wide=Math.min(e.w*.86,820);
      e.cx=e.w/2;e.cy=e.h*.5;e.th={x:e.cx-wide/2,y:e.cy-wide*.164,w:wide,h:wide*.328};
      return;
    }
    const r=stage.querySelector('.reveal-art').getBoundingClientRect(), t=stage.querySelector('.show-stage').getBoundingClientRect();
    e.cx=r.left+r.width/2;e.cy=Math.max(0,Math.min(e.h,r.top+r.height*.5));e.th={x:t.left,y:t.top,w:t.width,h:t.height};
    const total=document.querySelector('#masthead .stars');
    if(total){const b=total.getBoundingClientRect();e.starHome={x:b.left+11,y:b.top+b.height/2};}
  }
  function resize() {
    if(into) {
      const {width=520,height=390,unit=.6}=options.previewSize || {};
      e.w=width;e.h=height;e.u=unit;
      const wide=canvas.clientWidth || 260, dpr=Math.min(devicePixelRatio || 1,2);
      canvas.width=Math.round(wide*dpr);canvas.height=Math.round(wide*dpr*e.h/e.w);
    } else {
      e.w=window.innerWidth;e.h=window.innerHeight;
      const dpr=Math.min(devicePixelRatio || 1,1.6,Math.sqrt(2000000/(e.w*e.h)));
      canvas.width=Math.round(e.w*dpr);canvas.height=Math.round(e.h*dpr);
      e.u=Math.max(.67,Math.min(1.22,e.w/900));limit=e.w<650?230:360;
    }
    ctx.setTransform(canvas.width/e.w,0,0,canvas.height/e.h,0,0);ctx.lineJoin='round';ctx.lineCap='round';
    locate();
  }
  resize();

  const {acts,hit,total}=planShow({picks,alone,all,turn,letters:real && word && spell?word.length:0,staged:!!real,stars,tier});
  const hasPoppy=acts.some(([id])=>flowers[id]?.family==='poppy');
  const poppyBed=hasPoppy && real?.querySelector('.meadow-poppy');
  const poppyCanvas=poppyBed ? document.createElement('canvas') : null;
  if (poppyCanvas) {
    poppyCanvas.width=480;poppyCanvas.height=360;
    e.poppyCtx=poppyCanvas.getContext('2d');
  }
  const archCount=acts.filter(([id])=>prismParts[id]?.stays).length;
  e.soloPrism=!!prismParts[alone] && !(real && archCount);
  // In a found-word show the rising arches belong behind her word card.
  const archCanvas=real && archCount ? document.createElement('canvas') : null;
  if (archCanvas) {
    archCanvas.className='prism-stage';
    archCanvas.setAttribute('aria-hidden','true');
    e.archCtx=archCanvas.getContext('2d');
  }
  e.flowerBed={ids:acts.map(([id])=>id).filter(id=>flowers[id]),solo:!!flowers[alone],oak:acts.some(([id])=>id==='oak')};
  e.isolatedWoodland=!!woodlandParts[alone] || alone==='hats';
  const paradeFinds=alone && !finds.length ? ['cat','dog','hen'] : finds;
  e.paradeWords=paradeWords(paradeFinds,word,turn);
  e.hit=hit;e.total=total;

  function reset() {
    e.rand=random(977+turn*131);e.time=0;e.soak=0;sparks.length=0;rings.length=0;
    states=acts.map(([id,at])=>({at,part:PARTS[id],cue:0,s:PARTS[id].make?.(e) || {}}));
    states.sort((a,b)=>(a.part.z || 0)-(b.part.z || 0));
  }
  function advance(dt) {
    e.time+=dt;
    for(const st of states) {
      const t=e.time-st.at, p=st.part;
      if(t<0) continue;
      if(p.cues) while(st.cue<p.cues.length && p.cues[st.cue][0]<=t) p.cues[st.cue++][1](e,st.s);
      if(p.step && (p.stays || t<=p.len)) p.step(e,st.s,t,dt);
    }
    for(let i=rings.length-1;i>=0;i--){rings[i].age+=dt;if(rings[i].age>.48)rings.splice(i,1);}
    for(let i=sparks.length-1;i>=0;i--) {
      const p=sparks[i];p.age+=dt;
      if(p.age>=p.life || p.y>e.h+60){sparks.splice(i,1);continue;}
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.exp(-p.drag*dt);p.vy+=200*e.u*p.g*dt;p.rot+=p.spin*dt;
    }
  }
  function confetti() {
    for(const r of rings) {
      ctx.globalAlpha=(1-r.age/.48)*.84;ctx.strokeStyle='#eab447';ctx.lineWidth=3*e.u;
      ctx.beginPath();ctx.arc(r.x,r.y,5+r.r*r.age/.48,0,tau);ctx.stroke();
    }
    for(const p of sparks) {
      ctx.globalAlpha=Math.min(1,(p.life-p.age)*2.5);
      if(p.kind==='strip') {
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.fillStyle=p.colour;
        ctx.fillRect(-p.size*.32,-p.size,p.size*.65*Math.cos(p.age*3.3),p.size*2);ctx.restore();
      } else if(p.kind==='flower') flower(ctx,p.x,p.y,p.size,p.rot,p.colour);
      else if(p.kind==='petal') oval(ctx,p.x,p.y,p.size*.55,p.size,p.rot,p.colour,1.2);
      else if(p.kind==='drop') oval(ctx,p.x,p.y,p.size*.62,p.size*.9,Math.atan2(p.vx,-p.vy),p.colour,1.3);
      else if(p.kind==='dot'){ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,tau);ctx.fillStyle=p.colour;ctx.fill();}
      else drawStar(ctx,p.x,p.y,p.size,p.rot,p.kind==='star4'?four:five,p.colour);
    }
    ctx.globalAlpha=1;
  }
  function picture() {
    ctx.clearRect(0,0,e.w,e.h);
    if (e.archCtx) {
      const th=e.th, ratio=canvas.width/e.w;
      const wide=Math.max(1,Math.round(th.w*ratio)), tall=Math.max(1,Math.round(th.h*ratio));
      if (archCanvas.width!==wide || archCanvas.height!==tall) {archCanvas.width=wide;archCanvas.height=tall;}
      const sx=wide/th.w, sy=tall/th.h;
      e.archCtx.setTransform(sx,0,0,sy,-th.x*sx,-th.y*sy);
      e.archCtx.clearRect(th.x,th.y,th.w,th.h);
    }
    let scattered=false;
    for(const st of states) {
      const p=st.part, t=e.time-st.at;
      if(!scattered && (p.z || 0)>=5){confetti();scattered=true;}
      if(t>=0 && (p.stays || t<=p.len) && p.draw){ctx.globalAlpha=1;p.draw(e,st.s,t);}
    }
    if(!scattered) confetti();
    ctx.globalAlpha=1;
  }
  function stop(finished) {
    if(stopped) return;
    stopped=true;
    cancelAnimationFrame(frame);
    if(!into) {
      canvas.remove();stage?.classList.remove('show-playing');
      poppyCanvas?.remove();
      if (archCanvas) {archCanvas.remove();real.classList.remove('prism-playing');}
      window.removeEventListener('resize',resize);window.removeEventListener('scroll',locate);
      document.removeEventListener('visibilitychange',hidden);motion.removeEventListener('change',stop);
      if(stopActive===stop) stopActive=null;
    }
    if(freeze===null && (!into || !loop)) options.onEnd?.(finished===true);
  }
  function hidden() {if(document.hidden) stop();}
  function tick(now) {
    // A slow tablet draws fewer frames. The show still keeps real time, in steps small enough to stay smooth.
    let dt=Math.min((now-last)/1000,1.2);last=now;
    if(into?!canvas.isConnected:stage && !stage.isConnected){stop();return;}
    for(;dt>0;dt-=1/30) advance(Math.min(dt,1/30));
    if(e.time>=e.total){if(!into || !loop){stop(true);return;}reset();}
    picture();
    if(!into) canvas.style.opacity=clamp01((e.total-e.time)/.4);
    frame=requestAnimationFrame(tick);
  }
  if(!into) {
    stopActive=stop;
    window.addEventListener('resize',resize);window.addEventListener('scroll',locate,{passive:true});
    document.addEventListener('visibilitychange',hidden);motion.addEventListener('change',stop);
  }
  waitingForArtwork.delete(canvas);
  function start() {
    if(stopped) return;
    reset();
    if(real) {
      if(e.poppyCtx && e.poppyReady) poppyBed.append(poppyCanvas);
      if(e.archCtx) {
        real.querySelector('.rainbow-theatre').after(archCanvas);
        real.classList.add('prism-playing');
      }
      stage.style.setProperty('--hit',e.hit+'s');
      stage.style.setProperty('--after',Math.max(0,e.total-.5)+'s');
      stage.classList.remove('show-playing');void stage.offsetWidth;stage.classList.add('show-playing');
    }
    const poster=PARTS[alone]?.poster;
    const quietStill=poster===undefined ? e.total*.55 : acts.find(([id])=>id===alone)[1]+poster;
    const still=freeze!==null?freeze:into && loop && motion.matches?quietStill:null;
    if(still!==null) {
      while(e.time<still) advance(1/60);
      picture();
    } else {last=performance.now();frame=requestAnimationFrame(tick);}
  }
  // A cold sprite sheet must be decoded before the clock starts, including for
  // a reduced-motion still. A cancelled show or superseded poster stays stopped.
  const pending=acts.map(([id])=>PARTS[id].prepare?.(e)).filter(Boolean);
  if(pending.length) {
    waitingForArtwork.set(canvas,stop);
    Promise.all(pending).then(()=>{
      if(waitingForArtwork.get(canvas)!==stop) return;
      waitingForArtwork.delete(canvas);
      start();
    });
  } else start();
  return {hit:e.hit,total:e.total,stop};
}
export {finaleScenery, launchFinale, cancelFinale, prepareShow, planShow};
