import {colours,gold,ink,cream,water,tau,clamp01,ease,easeIn,pop,bump,five,four,starSvg,drawStar,paint,oval,flower,random} from './show-kit.js';
import {forms} from './drawings.js';
import {pathData} from './game.js';
import {SCENES} from './show-scenes.js';
import {CREATURES,SNAIL} from './show-creatures.js';

// The celebration show. It opens with a hush while her letters land, the star then reveals her picture,
// and the things she has added take turns after that. Her stars are counted out at the end.
const motion=matchMedia('(prefers-reduced-motion: reduce)');
const GROUND=['flowers','mushrooms','vines','oak'], SKY=['stars','fountains','blooms','paint'], BOW=['slide','ribbon'];
// Only two visitors and two big finishes play in one show, in rotation, so a full show stays near a quarter of a minute.
const VISIT=['bunnies','parade','dolphins','elephants'], FINISH=['fireflies','picture','whale'];
let stopActive=null, snail=null;

// A printed theatre stays on the page after the show and in reduced motion. The rainbows appear once she has added them.
function finaleScenery(picks=[]) {
  const stars=[[41,41,9],[89,93,5],[132,32,4],[165,72,8],[214,27,11],[69,157,11],[136,145,5],[104,204,4],
    [614,31,11],[660,78,5],[705,33,4],[755,74,10],[786,135,6],[690,170,9],[741,210,5],[41,213,4]];
  const cloud='<path d="M-10 263v-36q10-12 25-8c-2-21 25-34 41-21 2-30 41-41 57-17 21-17 51-3 51 17 28-6 47 11 43 31 28-6 42 12 41 28v14z" fill="#f5e4b4" stroke="#4c584a" stroke-width="3"/><path d="M10 231q12-8 22-4m37-28q14-12 27-5m24 19q15-8 24 1m26 18q13-7 21 2" fill="none" stroke="#ac9767" stroke-width="2.5" stroke-linecap="round"/>';
  const bands=second=>colours.map((c,i)=>{
    const r=second?188-i*7:278-i*10, ry=second?166-i*7:251-i*10;
    return `<path pathLength="1" style="--band-delay:${(second?.25:0)+i*.045}s" d="M${410-r} 265 A${r} ${ry} 0 0 1 ${410+r} 265" stroke="${second?colours[6-i]:c}" stroke-width="${second?7.4:10.8}"/>`;
  }).join('');
  return `<svg class="rainbow-theatre" viewBox="0 0 820 270" preserveAspectRatio="none" aria-hidden="true">
    <defs><radialGradient id="show-sky"><stop stop-color="#3d6053"/><stop offset="1" stop-color="#203c3c"/></radialGradient></defs>
    <rect width="820" height="270" fill="url(#show-sky)"/>
    <g fill="#fbd579" opacity=".09">${Array.from({length:24},(_,i)=>`<path d="M410 214 L389 -390 L431 -390Z" transform="rotate(${i*15} 410 214)"/>`).join('')}</g>
    <g fill="#ffdc83">${stars.map(([x,y,r],i)=>`<polygon points="${starSvg}" transform="translate(${x} ${y}) rotate(${i*19}) scale(${r})"/>`).join('')}</g>
    ${picks.includes('rainbow')?`<g fill="none" stroke-linecap="round" class="rainbow-bands">${bands(false)}${picks.includes('rainbow2')?bands(true):''}</g>
    <g fill="none" stroke="#fff5ca" stroke-width="2" stroke-dasharray="2 8"><path d="M122 265 A288 261 0 0 1 698 265"/></g>`:''}
    ${cloud}<g transform="translate(820 0) scale(-1 1)">${cloud}</g>
    <rect x="5" y="5" width="810" height="260" rx="13" fill="none" stroke="#dbc38a" stroke-opacity=".6" stroke-width="1.5"/>
  </svg>`;
}

// Her finds as paper cut-outs. The cream paper that touches the edge of each picture is cut away,
// and the inked lines are kept as points for the fireworks that take the picture's shape.
const cutouts=new Map();
function cutout(word) {
  let c=cutouts.get(word);
  if(c) return c;
  c={ready:false,canvas:null,points:[]};cutouts.set(word,c);
  const img=new Image();
  img.onload=()=>{
    const n=168, cv=document.createElement('canvas');cv.width=cv.height=n;
    const x=cv.getContext('2d',{willReadFrequently:true});
    try {
      x.drawImage(img,0,0,n,n);
      const data=x.getImageData(0,0,n,n), px=data.data;
      const lum=i=>(px[i*4]*.3+px[i*4+1]*.59+px[i*4+2]*.11)/255;
      // Paper next to an inked line stays, so a small gap in an outline does not let the cut leak inside.
      const paper=new Uint8Array(n*n);
      for(let i=0;i<n*n;i++){
        if(lum(i)<.8) continue;
        const col=i%n;let clear=true;
        for(const d of [-n-1,-n,-n+1,-1,1,n-1,n,n+1]){
          const j=i+d;
          if(j>=0 && j<n*n && Math.abs(j%n-col)<=1 && lum(j)<.6){clear=false;break;}
        }
        paper[i]=clear?1:0;
      }
      const out=new Uint8Array(n*n), stack=[];
      for(let i=0;i<n;i++) stack.push(i,(n-1)*n+i,i*n,i*n+n-1);
      while(stack.length){
        const i=stack.pop();
        if(out[i] || !paper[i]) continue;
        out[i]=1;const col=i%n;
        if(col>0)stack.push(i-1);if(col<n-1)stack.push(i+1);if(i>=n)stack.push(i-n);if(i<n*n-n)stack.push(i+n);
      }
      const dark=[];
      for(let i=0;i<n*n;i++){
        if(out[i]) px[i*4+3]=0;
        else if(lum(i)<.42) dark.push(i);
      }
      x.putImageData(data,0,0);
      const every=Math.max(1,Math.floor(dark.length/170));
      c.points=dark.filter((_,k)=>k%every===0).slice(0,180).map(i=>[(i%n)/n-.5,Math.floor(i/n)/n-.5]);
      c.canvas=cv;c.ready=true;
    } catch { /* A picture that cannot be read is left out of the show. */ }
  };
  img.src='./assets/words/'+word+'.webp';
  return c;
}
function prepareShow(words) {for(const w of words) cutout(w);}

// The parts that belong to every show.
const BASE={
  // The page dims and the light closes in on the empty stage, then flashes when the star arrives.
  hush:{len:99,z:0,
    draw(e,s,t) {
      const ctx=e.ctx, after=t-e.hit;
      const veil=after<0?.62*ease(t/.35):.62*(1-clamp01(after/.2));
      if(veil>0) {
        const far=Math.hypot(e.w,e.h), near=Math.max(e.th.w*.4,e.th.h*.9), r=far+(near-far)*ease(t/Math.max(.5,e.hit*.7));
        ctx.fillStyle=`rgba(22,38,31,${veil})`;ctx.fillRect(0,0,e.w,e.h);
        const hole=ctx.createRadialGradient(e.cx,e.cy,r*.7,e.cx,e.cy,r);hole.addColorStop(0,'#000');hole.addColorStop(1,'rgba(0,0,0,0)');
        ctx.globalCompositeOperation='destination-out';ctx.fillStyle=hole;ctx.beginPath();ctx.arc(e.cx,e.cy,r,0,tau);ctx.fill();
        ctx.globalCompositeOperation='source-over';
      }
      if(after>=0 && after<.32) {
        const glow=ctx.createRadialGradient(e.cx,e.cy,0,e.cx,e.cy,e.th.w*(.2+after*1.6));
        glow.addColorStop(0,`rgba(255,250,220,${.85*(1-after/.32)})`);glow.addColorStop(1,'rgba(255,250,220,0)');
        ctx.fillStyle=glow;ctx.fillRect(0,0,e.w,e.h);
      }
    }},
  // Her own writing lands one letter at a time on the empty stage. When the picture appears the letters fly home to the page.
  letters:{len:99,z:9,
    make(e) {
      const n=e.word.length, tall=Math.max(46,Math.min(e.th.h*.62,e.th.w*.82/(n*.62)));
      // Each letter's place is worked out from the stage as it is drawn, so the letters follow the page if it scrolls.
      return {tall,k:tall/138,landed:0,marks:[...e.word].map((c,i)=>{
        const lines=e.ink?.[i];
        let path;
        if(lines?.length) path=new Path2D(lines.map(pathData).join(' '));
        else {path=new Path2D();path.addPath(new Path2D(forms[c].join(' ')),new DOMMatrix().translate(42,0));}
        return {path,across:(i-(n-1)/2)*tall*.62};
      })};
    },
    step(e,s,t) {
      while(s.landed<s.marks.length && t>=s.landed*.5) {
        const x=e.cx+s.marks[s.landed].across;
        e.ring(x,e.cy,s.tall*.5);
        for(let k=0;k<5;k++) e.spark({x,y:e.cy+s.tall*.25,vx:(e.rand()-.5)*260*e.u,vy:-(60+e.rand()*150)*e.u,size:(3+e.rand()*3)*e.u,kind:'star4',life:.5+e.rand()*.3,colour:gold});
        e.on('onLetter',s.landed++);
      }
    },
    draw(e,s,t) {
      const ctx=e.ctx, leave=e.time-e.hit-.06;
      s.marks.forEach((m,i)=>{
        const a=t-i*.5+.22;
        if(a<0) return;
        const slam=1+3.2*(1-ease(a/.22));
        let x=e.cx+m.across, y=e.cy, k=s.k*slam, alpha=clamp01(a/.1);
        const go=clamp01((leave-i*.05)/.5);
        if(go>0) {
          const home=e.homes?.[i], f=go*go*(3-2*go);
          if(go>=1) return;
          if(home){x+=(home.x-x)*f;y+=(home.y-y)*f;k+=(home.k-k)*f;} else k*=1-f*.5;
          alpha=1-clamp01((go-.72)/.28);
        }
        ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.rotate((1-ease(a/.22))*-.25);ctx.scale(k,k);ctx.translate(-90,-69);
        ctx.lineCap='round';ctx.lineJoin='round';
        ctx.strokeStyle=ink;ctx.lineWidth=13.5;ctx.stroke(m.path);ctx.strokeStyle='#fff8e2';ctx.lineWidth=7.4;ctx.stroke(m.path);
        ctx.restore();
      });
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
const PARTS={...BASE,...SCENES,...CREATURES};

// Works out when each part of a show starts and how long the whole show runs. `letters` is how many of her letters
// land before the picture, which happens only where her word is on the page, and `staged` says whether the page has the stage.
// Each act is the part's name, its start, its length, and whether it then stays to the end.
function planShow({picks=[],alone='',all=false,turn=0,letters:n=0,staged=false,stars=0,tier=0}={}) {
  const acts=[], have=id=>(id===alone || picks.includes(id)) && PARTS[id];
  let end=0, hit=0;
  const add=(id,at,len=PARTS[id].len)=>{
    acts.push([id,at,Math.min(len,30),!!PARTS[id].stays]);
    if(!PARTS[id].stays) end=Math.max(end,at+Math.min(len,30));
    return at;
  };
  if(alone) {
    const friends={rainbow2:['rainbow'],slide:['rainbow'],ribbon:['rainbow'],music:['notes'],
      splash:['whale',...GROUND.filter(id=>picks.includes(id))],
      hats:[['bunnies','parade','dolphins','elephants','whale'].find(id=>picks.includes(id)) || 'bunnies']}[alone] || [];
    for(const id of friends) add(id,.1);
    if(PARTS[alone]) add(alone,alone==='splash'?1.95:friends.length?.6:.1);
    for(const [id,at] of acts) if(PARTS[id].stays) end=Math.max(end,at+PARTS[id].len+.9);
  } else {
    hit=n?.25+n*.5+.3:staged?.95:.74;
    if(staged) add('hush',0,hit+.35);
    if(n) add('letters',.25,hit+.45);
    add('comet',hit-.72);
    let t=hit+(n?.8:.45);
    GROUND.filter(have).forEach((id,k)=>add(id,hit+.15+k*.3));
    ['rainbow','rainbow2'].filter(have).forEach((id,k)=>add(id,hit+k*.25));
    // Each group starts while the one before it is finishing, so there is always one new thing to watch.
    const sky=SKY.filter(have), bow=BOW.filter(have);
    sky.forEach((id,k)=>add(id,t+k*.3));
    bow.forEach((id,k)=>add(id,t+(sky.length?.2:0)+k*.7));
    if(sky.length || bow.length) t=Math.max(t,end-1.2);
    for(const group of [VISIT,FINISH]) {
      const mine=group.filter(have), cast=all || mine.length<=2?mine:[0,1].map(k=>mine[(turn+k)%mine.length]);
      cast.forEach((id,k)=>{
        const at=add(id,t);
        if(id==='whale' && have('splash')) add('splash',at+1.85);
        t=at+PARTS[id].len*(k<cast.length-1?.55:1);
      });
      if(cast.length) t=Math.max(t,end)-.9;
    }
    if(tier){add('rosette',t);t+=1.1;}
    if(stars) add('tally',t,.22*stars+.95);
    else end=Math.max(end,t);
  }
  return {acts,hit,total:end+.6};
}
function releaseSnail() {
  snail?.remove();
  const el=snail=document.createElement('div');
  el.className='show-snail';el.setAttribute('aria-hidden','true');el.innerHTML=SNAIL;
  el.addEventListener('animationend',ev=>{if(ev.target===el){el.remove();if(snail===el)snail=null;}});
  document.body.append(el);
}
function cancelFinale() {stopActive?.();snail?.remove();snail=null;}

// Plays her show over the page. With `alone` it plays one addition by itself, with `into` it loops in a small
// canvas as a preview, and with `freeze` it draws the single frame at that many seconds so a frame can be checked.
function launchFinale(stage,options={}) {
  const {picks=[],finds=[],word='',ink:writing=null,stars=0,tier=0,turn=0,alone='',all=false,spell=true,freeze=null,into=null}=options;
  if(!into) cancelFinale();
  if(!into && freeze===null && (motion.matches || document.hidden)) return null;
  if(alone==='snail' && !into && freeze===null){releaseSnail();return {hit:0,total:0};}
  const canvas=into || document.createElement('canvas'), ctx=canvas.getContext('2d');
  if(!ctx) return null;
  const real=!into && stage?.querySelector('.rainbow-theatre') && stage.querySelector('.reveal-art')?stage:null;
  if(!into){canvas.className='fireworks-screen';canvas.setAttribute('aria-hidden','true');document.body.append(canvas);}
  const sparks=[], rings=[];
  let limit=320, frame=0, last=0, states=[];
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
  const e={ctx,w:0,h:0,u:1,cx:0,cy:0,th:null,virtual:!real,word,finds,ink:writing,stars,tier,time:0,total:0,hit:0,soak:0,homes:null,starHome:null,
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
    const label=stage.querySelector('.handwritten'), print=stage.querySelector('.found-word strong');
    e.homes=label?[...label.children].map(el=>{const b=el.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2,k:b.height/138};}):
      print?[...word].map((_,i)=>{const b=print.getBoundingClientRect();return {x:b.left+(i+.5)*b.width/word.length,y:b.top+b.height/2,k:b.height/138*.8};}):null;
    const total=document.querySelector('#masthead .stars');
    if(total){const b=total.getBoundingClientRect();e.starHome={x:b.left+11,y:b.top+b.height/2};}
  }
  function resize() {
    if(into) {
      e.w=520;e.h=390;e.u=.6;
      const wide=canvas.clientWidth || 260, dpr=Math.min(devicePixelRatio || 1,2);
      canvas.width=Math.round(wide*dpr);canvas.height=Math.round(wide*dpr*.75);
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
    cancelAnimationFrame(frame);
    if(!into) {
      canvas.remove();stage?.classList.remove('show-playing');
      window.removeEventListener('resize',resize);window.removeEventListener('scroll',locate);
      document.removeEventListener('visibilitychange',hidden);motion.removeEventListener('change',stop);
      if(stopActive===stop) stopActive=null;
      if(finished===true && !alone && e.has('snail')) releaseSnail();
      if(freeze===null) options.onEnd?.(finished===true);
    }
  }
  function hidden() {if(document.hidden) stop();}
  function tick(now) {
    // A slow tablet draws fewer frames. The show still keeps real time, in steps small enough to stay smooth.
    let dt=Math.min((now-last)/1000,1.2);last=now;
    if(into?!canvas.isConnected:stage && !stage.isConnected){stop();return;}
    for(;dt>0;dt-=1/30) advance(Math.min(dt,1/30));
    if(e.time>=e.total){if(!into){stop(true);return;}reset();}
    picture();
    if(!into) canvas.style.opacity=clamp01((e.total-e.time)/.4);
    frame=requestAnimationFrame(tick);
  }
  reset();
  if(real) {
    stage.style.setProperty('--hit',e.hit+'s');stage.style.setProperty('--home',(alone?0:e.hit+.5)+'s');
    stage.style.setProperty('--after',Math.max(0,e.total-.5)+'s');
    stage.classList.remove('show-playing');void stage.offsetWidth;stage.classList.add('show-playing');
  }
  if(!into) {
    stopActive=stop;
    window.addEventListener('resize',resize);window.addEventListener('scroll',locate,{passive:true});
    document.addEventListener('visibilitychange',hidden);motion.addEventListener('change',stop);
  }
  const still=freeze!==null?freeze:into && motion.matches?e.total*.55:null;
  if(still!==null) {
    while(e.time<still) advance(1/60);
    picture();
  } else {last=performance.now();frame=requestAnimationFrame(tick);}
  return {hit:e.hit,total:e.total,stop};
}
export {finaleScenery, launchFinale, cancelFinale, prepareShow, planShow};
