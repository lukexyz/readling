import {finaleScenery,meadowLayout,visitorLane} from './meadow.js';
import {cutout,prepareShow} from './show-cutouts.js';
import {colours,gold,ink,cream,water,tau,clamp01,ease,easeIn,pop,bump,five,four,drawStar,paint,oval,flower,random} from './show-kit.js';
import {SCENES} from './show-scenes.js';
import {CREATURES} from './show-creatures.js';
import {orcas} from './ember-breach.js';
import {dolphinFamilies} from './dolphins.js';
import {dolphins} from './show-dolphins.js';
import {flowerFamilies} from './gardens.js';
import {flowers} from './show-flowers.js';
import {highestWoodland} from './woodland.js';
import {woodlandParts,paradeWords} from './show-woodland.js';
import {highestPrism,prismByFamily} from './prism.js';
import {prismParts} from './show-prism.js';

// The celebration show. Her letter sounds play, the star reveals her picture,
// and the things she has added take turns after that. Her stars are counted out at the end.
const GROUND=['mushrooms','vines','oak'], SKY=['stars','fountains','blooms','paint'];
// Word and memory rewards rotate through the collection. The full rehearsal plays every family.
const VISIT=['bunnies','parade','dolphins','elephants'];
let stopActive=null;
const waitingForArtwork=new WeakMap();

// The parts that belong to every show.
const BASE={
  // Sound out the word while the learner's handwriting stays in place.
  letters:{len:99,z:9,
    make() {return {spoken:0};},
    step(e,s,t) {
      while(s.spoken<e.soundCount && t>=s.spoken*.5) e.on('onLetter',s.spoken++);
    }},
  // Each star she earned pops out of her picture and flies up to her total.
  tally:{len:99,z:9,
    make() {return {launched:0,landed:0};},
    step(e,s,t) {
      const to=e.starHome || {x:e.w-44,y:34};
      while(s.launched<e.stars && t>=s.launched*.22) e.on('onStarLift',s.launched++);
      while(s.landed<e.stars && t>=s.landed*.22+.83){s.landed++;e.ring(to.x,to.y,34*e.u);e.on('onStar',s.landed-1);}
    },
    draw(e,s,t) {
      const to=e.starHome || {x:e.w-44,y:34};
      for(let i=0;i<e.stars;i++) {
        const a=t-i*.22;
        if(a<0 || a>=.83) continue;
        const origin=e.starOrigins?.[i] || {x:e.cx,y:e.cy};
        const rest=e.starOrigins?.[i]?{x:origin.x,y:origin.y-19*e.u}:
          {x:e.cx+(i-(e.stars-1)/2)*38*e.u,y:e.cy-e.th.h*.36};
        let x,y,size;
        if(a<.38){const g=ease(a/.2);x=origin.x+(rest.x-origin.x)*g;y=origin.y+(rest.y-origin.y)*g;size=18*e.u*pop(a/.22);}
        else {const f=easeIn((a-.38)/.45);x=rest.x+(to.x-rest.x)*f;y=rest.y+(to.y-rest.y)*f-Math.sin(f*Math.PI)*40*e.u;size=18*e.u*(1-f*.45);}
        drawStar(e.ctx,x,y,size,a*5,five,'#ffd752');
      }
    }},
  // Pin the badge she just earned in the meadow. Standalone show studies can use a plain rosette.
  rosette:{len:1.5,stays:true,z:7,
    cues:[[.2,e=>{const p=pin(e);e.burst(p.x,p.y,18,84,{g:.45});}]],
    draw(e,s,t) {
      if(e.badgeImage) {
        if(!e.badgeImage.complete || !e.badgeImage.naturalWidth) return;
        const p=pin(e), side=Math.min(108*e.u,e.th.w*.22,e.th.h*.34,e.field ? (e.w-e.field.right)*.86 : Infinity);
        const size=side*(.72+.28*ease(t/.24));
        e.ctx.save();e.ctx.globalAlpha=clamp01(t/.16);
        e.ctx.drawImage(e.badgeImage,p.x-size/2,p.y-size/2,size,size);e.ctx.restore();
        return;
      }
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
const pin=e=>({x:e.field?(e.w+e.field.right)*.5:e.th.x+e.th.w*.86,y:e.th.y+e.th.h*.23});
const PARTS={...BASE,...SCENES,...CREATURES,...orcas,...dolphins,...flowers,...woodlandParts,...prismParts};
const isVisitor=id=>Boolean(orcas[id] || dolphins[id] || (woodlandParts[id] && !woodlandParts[id].stays) || id==='splash');

// A normal reward gives one supporting scene and one visitor or finale a turn.
// The dolphin families share a slot, and rotate each time that slot comes round.
function planShow({picks=[],alone='',all=false,turn=0,letters:n=0,staged=false,stars=0,tier=0}={}) {
  const acts=[], visitorSides={}, have=id=>id===alone || picks.includes(id);
  const prism=key=>highestPrism(key,have)?.id;
  const gardens=flowerFamilies.map(f=>f.shots.findLast(s=>have(s.id))?.id);
  const roots=GROUND.map(key=>key==='oak' ? have(key) && key : highestWoodland(key,have));
  const sky=SKY.map(key=>prismByFamily[key]?prism(key):have(key) && key);
  const scenery=[prism('rainbow'),prism('rainbow2'),...gardens,...roots,...sky].filter(Boolean);
  const jumps=dolphinFamilies.map(f=>f.levels.findLast(s=>have(s.id))?.id).filter(Boolean);
  const whale=['whale3','whale2','whale'].find(have);
  const visitors=VISIT.map(key=>key==='dolphins'?jumps:[highestWoodland(key,have)]);
  const features=[...visitors,[have('fireflies') && 'fireflies'],[prism('picture')],[whale]]
    .filter(group=>group[0]);
  let end=0, hit=0;
  function add(id,at,len=PARTS[id].len) {
    if(isVisitor(id)) {
      const side=woodlandParts[id]?.family==='bunnies'?'right':
        orcas[id] || ['parade','elephants'].includes(woodlandParts[id]?.family)?'left':'right';
      visitorSides[id]=id==='splash'?'left':side;
      if(id==='splash') {
        const rabbit=highestWoodland('bunnies',have);
        if(rabbit) visitorSides[rabbit]='right';
      }
    }
    acts.push([id,at,len,!!PARTS[id].stays]);
    end=Math.max(end,at+len);
  }
  if(alone) {
    if(alone==='music') add('notes',0);
    else if(alone==='hats') add(visitors.flat().find(Boolean) || whale || 'bunnies',.1);
    else if(alone==='splash') {
      const actor=whale || 'whale';
      add(actor,.1);add('splash',.1+orcas[actor].contact);
    } else if(PARTS[alone]) add(alone,.1,alone==='tally'?.22*stars+.95:PARTS[alone].len);
  } else {
    hit=n?.25+n*.5+.3:staged?.95:.74;
    if(n) add('letters',.25,hit-.25);
    add('comet',hit-.72);
    let t=hit+(n?.65:.25);
    if(have('music')) {add('notes',t);t=end+.08;}
    // With a fanfare the notes already open the show. Alternate the garden and
    // visitor spotlights so a full collection still leaves a short path to the tally.
    const alternate=!all && have('music') && scenery.length && features.length;
    const rotation=alternate?Math.floor(turn/2):turn;
    const opening=all?scenery:scenery.length && (!alternate || turn%2===0)?[scenery[rotation%scenery.length]]:[];
    const family=features[rotation%features.length];
    const featured=all?features.flat():family && (!alternate || turn%2===1)?[family[Math.floor(rotation/features.length)%family.length]]:[];
    for(const id of [...opening,...featured]) {
      add(id,t);
      if(id===whale && have('splash')) add('splash',t+orcas[id].contact);
      t=end+.15;
    }
    if(tier) {add('rosette',t);t=end+.12;}
    if(stars) add('tally',t,.22*stars+.95);
  }
  return {acts,hit,total:end+(alone ? .6 : .42),visitorSides};
}
function cancelFinale() {stopActive?.();}

// Plays her show over the page. With `alone` it plays one addition by itself, with `into` it loops in a small
// canvas as a preview. Set `loop` to false for a user-triggered clip, or `freeze` to a time for a still.
function launchFinale(stage,options={}) {
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const {picks=[],finds=[],word='',stars=0,tier=0,turn=0,alone='',all=false,spell=true,freeze=null,into=null,loop=true,review=false}=options;
  if(!into) cancelFinale();
  const meadow=stage?.querySelector('.show-stage:has(.reveal-art .stamp)');
  const real=meadow?.querySelector('.rainbow-theatre')?stage:null;
  const quietPick=!!(real && alone && options.keepStill && !review && freeze===null && motion.matches);
  if(!into && !review && freeze===null && (document.hidden || motion.matches && !quietPick)) return null;
  const canvas=into || document.createElement('canvas'), ctx=canvas.getContext('2d');
  // Ground actors and show extras have their own small canvas. Its drawing units are
  // device pixels; a 480 px render occupies 240 CSS px on a 2× tablet.
  const floorCanvas=into || document.createElement('canvas'), floorCtx=floorCanvas.getContext('2d');
  if(!ctx || !floorCtx) return null;
  const soundCount=options.soundCount??word.length;
  const {acts,hit,total,visitorSides}=planShow({picks,alone,all,turn,letters:real && spell?soundCount:0,staged:!!real,stars,tier});
  const music=acts.find(([id])=>id==='notes'), tally=acts.find(([id])=>id==='tally');
  const gates=new Map();
  function waitFor(promise,until) {
    if(!promise?.then || until==null) return;
    const key={};gates.set(key,until);
    Promise.resolve(promise).then(()=>gates.delete(key),()=>gates.delete(key));
  }
  function mount(layer,host,className) {
    layer.className=className;layer.setAttribute('aria-hidden','true');host.append(layer);
  }
  if(!into && (!real || acts.some(([id])=>id==='tally'))) mount(canvas,document.body,'fireworks-screen');
  if(!into) mount(floorCanvas,meadow || document.body,'show-floor');
  let limit=320, frame=0, last=0, states=[], stopped=false, seeking=false;
  function burst(e,x,y,n,energy,{sky=false,kind='mix',g=1,drag=.55}={}) {
    e.ring(x,y,energy*.28*e.u);
    for(let i=0;i<n;i++) {
      const angle=i*tau/n+e.rand()*.15, speed=energy*(.35+e.rand()*.68)*e.u, sort=i%6;
      const p={x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-(sky?energy*.52:35)*e.u,life:1.45+e.rand()*1.65,
        rot:e.rand()*tau,spin:e.rand()*5-2.5,g,drag,colour:i%4===0?gold:colours[i%colours.length]};
      if(kind==='flower') Object.assign(p,{kind:i%2?'petal':'flower',size:(i%2?4+e.rand()*3:9+e.rand()*6)*e.u,colour:colours[(i>>1)%7],life:2+e.rand()*1.2,spin:e.rand()*3-1.5});
      else Object.assign(p,{kind:sort===1 || sort===4?'strip':sort===3?'star4':'star5',size:(sort===0?10+e.rand()*10:3+e.rand()*6)*e.u});
      e.spark(p);
    }
  }
  const e={ctx,w:0,h:0,u:1,cx:0,cy:0,th:null,virtual:!real,word,soundCount,finds,handwriting:options.handwriting,stars,tier,time:0,total:0,hit:0,soak:0,starHome:null,
    preview:!!into,rand:random(1),has:id=>id===alone || picks.includes(id),cut:cutout,
    // Her hat sits on any creature that asks for one, once she has added hats to her show.
    hat(x,y,angle,size) {
      const c=e.has('hats') && cutout('hat');
      if(!c?.ready) return;
      const pen=this.ctx;
      const tip=alone==='hats'?.19*bump((this.time-.75)/.75):0;
      pen.save();pen.translate(x,y);pen.rotate(angle-tip);
      pen.shadowColor='#465640a6';pen.shadowBlur=1;
      pen.drawImage(c.canvas,-size/2,-size*(.74+tip*.3),size,size);pen.restore();
    },
    on(name,...args) {
      if(seeking || quietPick || review || freeze!==null || into) return;
      const audio=options[name]?.(...args);
      // Let the clock approach the next cue at its usual pace. A longer recording
      // holds only that boundary; the next frame resumes when playback ends.
      if(name==='onLetter') {
        const next=args[0]+1;
        waitFor(audio,(next<soundCount ? .25+next*.5 : hit)-.002);
      }
      if(name==='onHit') waitFor(audio,(music?.[1] ?? tally?.[1] ?? total)-.002);
      if(name==='onMusic' && music) {
        waitFor(audio?.started,e.time);
        waitFor(audio,music[1]+music[2]-.002);
      }
    }};
  const floor={...e,ctx:floorCtx};
  let inkView;
  if(real && acts.some(([id])=>id==='comet' || id==='rosette' || id.startsWith('picture'))) {
    const layer=document.createElement('canvas');
    mount(layer,meadow,'show-ink');inkView={...e,ctx:layer.getContext('2d')};
  }
  const wings={};
  const laneFor=id=>woodlandParts[id] && !woodlandParts[id].stays?'path':visitorSides[id];
  const lanesNeeded=new Set(acts.map(([id])=>laneFor(id)).filter(Boolean));
  const splashRabbit=!!visitorSides.splash && !!highestWoodland('bunnies',e.has);
  if(splashRabbit) lanesNeeded.add('right');
  if(real) for(const side of lanesNeeded) {
    const layer=document.createElement('canvas');
    mount(layer,meadow,'show-visitors');layer.dataset.side=side;
    wings[side]={...e,ctx:layer.getContext('2d'),panelSide:side};
  }
  const wingViews=Object.values(wings), groundViews=[floor,...wingViews];
  const localViews=inkView?[...groundViews,inkView]:groundViews, views=[...localViews,e];
  const splashView=wings[visitorSides.splash] || floor;
  if(splashRabbit && wings.right) splashView.rabbitView=wings.right;
  for(const view of views) {
    view.sparks=[];view.rings=[];
    view.spark=p=>{
      view.sparks.push({age:0,life:1.5,size:6*view.u,rot:0,spin:0,kind:'star5',colour:gold,g:1,drag:.55,vx:0,vy:0,...p});
      if(view.sparks.length>limit) view.sparks.splice(0,view.sparks.length-limit);
    };
    view.burst=(...args)=>burst(view,...args);
    view.ring=(x,y,r)=>view.rings.push({x,y,age:0,r});
  }
  if(tier && options.badgeSrc) {
    e.badgeImage=new Image();e.badgeImage.src=options.badgeSrc;
    if(inkView) inkView.badgeImage=e.badgeImage;
  }
  // The Blender camera and the printed poster occupy the same bed behind the word card.
  const planted=new Map();
  for(const [id] of acts) {
    if(!real || !flowers[id]) continue;
    const bed=real.querySelector(`[data-meadow-flower="${id}"]`);
    if(!bed) continue;
    const layer=document.createElement('canvas');layer.className='meadow-growth';layer.width=480;layer.height=360;
    const view=Object.assign(Object.create(floor),{ctx:layer.getContext('2d'),w:480,h:360,flowerBed:{ids:[id],solo:true}});
    bed.append(layer);planted.set(id,{layer,view});
  }
  function locate() {
    if(!real) {
      const wide=Math.min(e.w*.86,820);
      e.cx=e.w/2;e.cy=e.h*.5;e.th={x:e.cx-wide/2,y:e.cy-wide*.164,w:wide,h:wide*.328};
      return;
    }
    if(!floor.target || !meadow.clientWidth) return;
    const frame=meadow.getBoundingClientRect(), d=floor.w/meadow.clientWidth;
    e.th={x:frame.left+meadow.clientLeft,y:frame.top+meadow.clientTop,w:meadow.clientWidth,h:meadow.clientHeight};
    e.cx=e.th.x+floor.target.x/d;e.cy=e.th.y+floor.target.y/d;
    if(real.classList.contains('round-done')) {
      const origins=[...meadow.querySelectorAll('.reveal-art .stamp')].map(card=>{
        const box=card.getBoundingClientRect();return {x:box.right-6,y:box.top+6};
      });
      e.starOrigins=options.starCards?.map(index=>origins[index]) || origins;
    }
    const icon=document.querySelector('#masthead .stars > :first-child');
    if(icon){const b=icon.getBoundingClientRect();e.starHome={x:b.left+b.width/2,y:b.top+b.height/2};}
  }
  function sizeStrip(view) {
    const layer=view.ctx.canvas, rect=layer.getBoundingClientRect(), dpr=window.devicePixelRatio || 1;
    const w=Math.max(1,Math.round(rect.width*dpr)), h=Math.max(1,Math.round(rect.height*dpr));
    if(layer.width!==w) layer.width=w;
    if(layer.height!==h) layer.height=h;
    view.w=w;view.h=h;view.pixelsPerCssPixel=dpr;view.u=Math.min(1,h/360,w/480);
    view.cx=w/2;view.cy=h/2;view.th={x:0,y:0,w,h};
    view.ctx.lineJoin='round';view.ctx.lineCap='round';
  }
  function fitMeadow() {
    const field=meadowLayout(meadow,word);
    const lanes={};
    for(const view of wingViews) {
      const lane=visitorLane(field,view.panelSide,!!splashView.rabbitView);
      lanes[view.panelSide]=lane;
      Object.assign(view.ctx.canvas.style,{left:lane.x+'px',top:lane.y+'px',width:lane.w+'px',height:lane.h+'px'});
      sizeStrip(view);view.field=field;
    }
    for(const view of [floor,inkView].filter(Boolean)) {
      sizeStrip(view);
      const d=view.w/field.w;
      view.field={left:field.left*d,right:field.right*d,top:field.top*d,bottom:field.bottom*d};
      view.target={x:field.target.x*d,y:field.target.y*d,size:field.target.size*d,angle:field.target.angle};
      view.u=Math.min(view.h/230,view.w/390,1.18*d);
    }
    if(inkView){inkView.cx=inkView.target.x;inkView.cy=inkView.target.y;}
    const frame=floor.ctx.canvas.getBoundingClientRect(), scale=floor.w/frame.width;
    if(wings.path) wings.path.ticketBed={view:floor,y:lanes.path.y*scale,dx:floor.w/wings.path.w,dy:lanes.path.h*scale/wings.path.h};
    for(const {layer,view} of planted.values()) {
      const bed=layer.parentElement?.getBoundingClientRect();
      if(bed) view.bed={pen:floor.ctx,x:(bed.left-frame.left+bed.width/2)*scale,
        y:(bed.bottom-frame.top)*scale,w:bed.width*scale,h:bed.height*scale};
    }
    if(splashView.rabbitView) {
      const d=floor.w/field.w, {left,right}=lanes;
      splashView.crossing={view:floor,from:(left.x+left.w*.55)*d,y:(left.y+left.h*.88)*d,
        destX:right.x*d,destY:right.y*d,scaleX:right.w*d/wings.right.w,scaleY:right.h*d/wings.right.h};
    }
  }
  function resize() {
    if(real && (!meadow.clientWidth || !meadow.clientHeight)) return;
    if(into) {
      const {width=520,height=390,unit=.6}=options.previewSize || {};
      e.w=width;e.h=height;e.u=unit;
      const wide=canvas.clientWidth || 260, dpr=Math.min(devicePixelRatio || 1,2);
      canvas.width=Math.round(wide*dpr);canvas.height=Math.round(wide*dpr*e.h/e.w);
    } else {
      e.w=window.innerWidth;e.h=window.innerHeight;
      const dpr=Math.min(devicePixelRatio || 1,1.6,Math.sqrt(2000000/(e.w*e.h)));
      canvas.width=canvas.isConnected?Math.round(e.w*dpr):1;canvas.height=canvas.isConnected?Math.round(e.h*dpr):1;
      e.u=Math.max(.67,Math.min(1.22,e.w/900));limit=e.w<650?230:360;
    }
    ctx.setTransform(canvas.width/e.w,0,0,canvas.height/e.h,0,0);ctx.lineJoin='round';ctx.lineCap='round';
    if(into) {
      floor.w=e.w;floor.h=e.h;floor.u=e.u;
      floor.cx=e.w/2;floor.cy=e.h/2;floor.th={x:0,y:0,w:e.w,h:e.h};
    } else {
      const dpr=window.devicePixelRatio || 1;
      real?.querySelector('.meadow-garden')?.style.setProperty('--native-flower-width',480/dpr+'px');
      if(real) fitMeadow();else sizeStrip(floor);
    }
    locate();
    if(states.length) seek(e.time,true);
  }
  resize();
  const roomObserver=real ? new ResizeObserver(()=>{if(!stopped) resize();}) : null;
  if(roomObserver) {roomObserver.observe(meadow);roomObserver.observe(meadow.querySelector('.reveal-art'));}

  floor.soloPrism=!review && !!prismParts[alone];
  const meadowArches=real?acts.filter(([id])=>prismParts[id]?.stays)
    .map(([id,at])=>[real.querySelector(`[data-meadow-rainbow="${id}"]`),at]).filter(([arch])=>arch):[];
  floor.flowerBed={ids:acts.map(([id])=>id).filter(id=>flowers[id]),solo:!review && !!flowers[alone],oak:acts.some(([id])=>id==='oak')};
  const paradeFinds=alone && !finds.length ? ['cat','dog','hen'] : finds;
  const wagons=paradeWords(paradeFinds,word,turn);
  for(const view of groundViews) {
    view.isolatedWoodland=!review && (!!woodlandParts[alone] || alone==='hats');
    view.paradeWords=wagons;
  }
  for(const view of views) {view.hit=hit;view.total=total;}
  // The star, letters and badge still land on their actual targets in the word card and header.
  function viewFor(id) {
    if(id==='comet' || id==='rosette') return inkView || e;
    if(id.startsWith('picture') && inkView) return inkView;
    if(Object.hasOwn(BASE,id)) return e;
    return planted.get(id)?.view || wings[laneFor(id)] || floor;
  }

  function reset() {
    for(const view of views) {
      view.rand=random(977+turn*131);view.time=0;view.soak=0;view.sparks.length=0;view.rings.length=0;
    }
    states=acts.map(([id,at])=>{
      const view=viewFor(id),part=PARTS[id];
      return {at,part,view,cue:0,s:part.make?.(view) || {}};
    });
    states.sort((a,b)=>(a.part.z || 0)-(b.part.z || 0));
  }
  function advance(dt) {
    for(const view of views) view.time+=dt;
    for(const st of states) {
      const t=e.time-st.at, p=st.part;
      if(t<0) continue;
      if(p.cues) while(st.cue<p.cues.length && p.cues[st.cue][0]<=t) p.cues[st.cue++][1](st.view,st.s);
      if(p.step && (p.stays || t<=p.len)) p.step(st.view,st.s,t,dt);
    }
    floor.soak=splashView.soak;
    for(const view of views) advanceParticles(view,dt);
  }
  function advanceParticles(view,dt) {
    const {rings,sparks}=view;
    for(let i=rings.length-1;i>=0;i--){rings[i].age+=dt;if(rings[i].age>.48)rings.splice(i,1);}
    for(let i=sparks.length-1;i>=0;i--) {
      const p=sparks[i];p.age+=dt;
      if(p.age>=p.life || p.y>view.h+60){sparks.splice(i,1);continue;}
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.exp(-p.drag*dt);p.vy+=200*view.u*p.g*dt;p.rot+=p.spin*dt;
    }
  }
  const entrances=acts.filter(([id])=>isVisitor(id) && id!=='splash').map(([,at])=>at);
  function confetti(view) {
    const {ctx,rings,sparks,u}=view;
    const visitor=view===floor && !into?entrances.findLast(at=>e.time>=at):undefined;
    const fade=visitor===undefined?1:1-clamp01((e.time-visitor)/.32);
    for(const r of rings) {
      ctx.globalAlpha=(1-r.age/.48)*.84*(e.time-r.age<visitor?fade:1);ctx.strokeStyle='#eab447';ctx.lineWidth=3*u;
      ctx.beginPath();ctx.arc(r.x,r.y,5+r.r*r.age/.48,0,tau);ctx.stroke();
    }
    for(const p of sparks) {
      ctx.globalAlpha=Math.min(1,(p.life-p.age)*2.5)*(e.time-p.age<visitor?fade:1);
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
    if(!review && freeze===null && !quietPick) for(const [arch,at] of meadowArches) {
      if(e.time>=at && arch.classList.contains('waiting-arch')) arch.classList.replace('waiting-arch','tracing');
    }
    if(real && !quietPick && !alone) {
      stage.classList.toggle('awaiting-picture',e.time<hit);
      stage.classList.toggle('picture-revealed',e.time>=hit);
    }
    ctx.clearRect(0,0,e.w,e.h);
    if(!into) for(const view of localViews) view.ctx.clearRect(0,0,view.w,view.h);
    for(const {view} of planted.values()) view.ctx.clearRect(0,0,view.w,view.h);
    let scattered=false;
    for(const st of states) {
      const p=st.part, t=e.time-st.at;
      if(!scattered && (p.z || 0)>=5){for(const view of views) confetti(view);scattered=true;}
      if(t>=0 && (p.stays || t<=p.len) && p.draw){st.view.ctx.globalAlpha=1;p.draw(st.view,st.s,t);}
    }
    if(!scattered) for(const view of views) confetti(view);
    for(const view of views) view.ctx.globalAlpha=1;
  }
  function stop(finished) {
    if(stopped) return;
    stopped=true;
    cancelAnimationFrame(frame);
    if(!into) {
      canvas.remove();stage?.classList.remove('show-playing','awaiting-picture','picture-revealed');
      floorCanvas.remove();inkView?.ctx.canvas.remove();
      stage?.style.removeProperty('--review-time');
      roomObserver?.disconnect();
      for(const view of wingViews) view.ctx.canvas.remove();
      for(const {layer} of planted.values()) layer.remove();
      for(const [arch] of meadowArches) arch.classList.remove('tracing','waiting-arch');
      window.removeEventListener('resize',resize);window.removeEventListener('scroll',locate);
      document.removeEventListener('visibilitychange',hidden);motion.removeEventListener('change',stop);
      if(stopActive===stop) stopActive=null;
    }
    if(!quietPick && freeze===null && (!into || !loop)) options.onEnd?.(finished===true);
  }
  function hidden() {if(document.hidden && !review) stop();}
  let holdLeft=options.keepStill && !quietPick && alone!=='music' && alone!=='fireflies' ? .55 : 0;
  function tick(now) {
    // A slow tablet draws fewer frames. The show still keeps real time, in steps small enough to stay smooth.
    let dt=Math.min((now-last)/1000,1.2);last=now;
    if(into?!canvas.isConnected:stage && !stage.isConnected){stop();return;}
    if(holdLeft && e.time+dt>=quietStill) {
      const approach=Math.max(0,quietStill-e.time);
      const pause=Math.min(holdLeft,dt-approach);
      holdLeft-=pause;dt-=pause;
    }
    for(;dt>0;dt-=1/30) {
      let step=Math.min(dt,1/30);
      for(const until of gates.values()) step=Math.min(step,until-e.time);
      if(step<=.00001) break;
      advance(step);
    }
    if(e.time>=e.total){if(!into || !loop){stop(true);return;}reset();}
    picture();
    if(!into) for(const view of views) view.ctx.canvas.style.opacity=clamp01((e.total-e.time)/.4);
    frame=requestAnimationFrame(tick);
  }
  if(!into) {
    stopActive=stop;
    window.addEventListener('resize',resize);window.addEventListener('scroll',locate,{passive:true});
    document.addEventListener('visibilitychange',hidden);if(!review) motion.addEventListener('change',stop);
  }
  waitingForArtwork.delete(canvas);
  let quietStill=0;
  // The full-size viewer drives this same show by time. Rewinding recreates the
  // seeded particles and poses, so scrubbing never depends on the previous frame.
  function seek(seconds,rewind=false) {
    if(stopped) return;
    const target=Math.max(0,Math.min(seconds,total));
    seeking=true;
    if(rewind || target<e.time) reset();
    while(target-e.time>1/30) advance(1/30);
    if(target>e.time) advance(target-e.time);
    seeking=false;picture();
    for(const view of views) view.ctx.canvas.style.opacity=clamp01((total-target)/.4);
    if(review && meadowArches.length) stage.style.setProperty('--review-time',target+'s');
  }
  function start() {
    if(stopped) return;
    reset();
    for(const {view,layer} of planted.values()) if(!view.flowerReady) layer.remove();
    if(real && !quietPick) {
      for(const [arch,at] of meadowArches) {
        const scripted=review || freeze!==null;
        arch.style.setProperty('--arch-start',(scripted?at:0)+'s');
        arch.classList.add(scripted?'tracing':'waiting-arch');
      }
      stage.classList.remove('show-playing');void stage.offsetWidth;stage.classList.add('show-playing');
      if(!alone) stage.classList.add('awaiting-picture');
    }
    const feature=acts.find(([id])=>id===alone) || acts[0];
    const poster=PARTS[feature?.[0]]?.poster;
    quietStill=feature ? feature[1]+(poster ?? feature[2]*.53) : e.total*.5;
    if(review) {seek(quietStill);return;}
    const still=freeze!==null?freeze:quietPick || into && loop && motion.matches?quietStill:null;
    if(still!==null) {
      seek(still);
    } else {last=performance.now();frame=requestAnimationFrame(tick);}
  }
  // A cold sprite sheet must be decoded before the clock starts, including for
  // a reduced-motion still. A cancelled show or superseded poster stays stopped.
  const pending=acts.map(([id])=>PARTS[id].prepare?.(viewFor(id))).filter(Boolean);
  if(e.has('hats') && acts.some(([id])=>isVisitor(id))) pending.push(prepareShow(['hat']));
  if(review && e.badgeImage) pending.push(e.badgeImage.decode());
  let ready;
  if(pending.length) {
    waitingForArtwork.set(canvas,stop);
    ready=Promise.all(pending).then(()=>{
      if(waitingForArtwork.get(canvas)!==stop) return;
      waitingForArtwork.delete(canvas);
      start();
    });
  } else start();
  if(quietPick) return null; // The static pose stays until navigation. The learner can act immediately.
  if(review) return {hit,total,stop,seek,ready:ready || Promise.resolve(),get posterTime(){return quietStill;}};
  return {hit:e.hit,total:e.total,stop};
}
export {finaleScenery, launchFinale, cancelFinale, prepareShow, planShow};
