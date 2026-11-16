import {colours,gold,ink,cream,green,tau,clamp01,ease,easeIn,pop,bump,five,four,drawStar,paint,oval,flower,leafShape,band} from './show-kit.js';
import {poppyScene} from './poppy.js';
import {forms} from './drawings.js';

// The star that reveals her picture, and everything she can add to the sky, the rainbow and the ground.
// Each part has a length in seconds and a drawing order. A part that stays keeps drawing until the show ends.

// The star bounds in off one peg and lands on her picture.
const beats=[[0,-.30,-.27],[.3,.33,-.22],[.72,0,0]];
const peg=(e,j)=>({x:e.cx+beats[j][1]*e.w,y:Math.max(48,e.cy+beats[j][2]*e.h)});
function ballAt(e,t) {
  let j=1;while(j<beats.length-1 && beats[j][0]<t)j++;
  const a=peg(e,j-1), b=peg(e,j), p=clamp01((t-beats[j-1][0])/(beats[j][0]-beats[j-1][0]));
  return {x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p-Math.sin(p*Math.PI)*Math.min(105,e.h*.12)};
}
const few=(e,n)=>Math.round(n*(e.w<650?.7:1));
// A rainbow drawn on the show itself, for previews and for pages that have no printed theatre.
function arcs(e,t,second) {
  const ctx=e.ctx;
  for(let i=0;i<7;i++) {
    const b=band(e.th,i,second), p=ease((t-i*.045)/1.1);
    if(p<=0) continue;
    ctx.beginPath();ctx.ellipse(b.x,b.y,b.rx,b.ry,0,Math.PI,Math.PI*(1+p));
    ctx.strokeStyle=colours[second?6-i:i];ctx.lineWidth=b.width;ctx.lineCap='butt';ctx.stroke();
  }
  ctx.lineCap='round';
}
// Sparkles run along the front of the rainbow as it is drawn.
function glint(e,s,t,dt,second) {
  if(t>1.1) return;
  s.next=(s.next || 0)-dt;
  if(s.next>0) return;
  s.next=.045;
  const b=band(e.th,3,second), a=Math.PI*(1+ease(t/1.1));
  e.spark({x:b.x+b.rx*Math.cos(a),y:b.y+b.ry*Math.sin(a),vx:(e.rand()-.5)*90*e.u,vy:-e.rand()*80*e.u,size:(3+e.rand()*4)*e.u,
    kind:e.rand()<.5?'star4':'star5',life:.45+e.rand()*.4,colour:e.rand()<.5?gold:'#fff5ca',g:.6});
}
function rider(e,t) {
  const b=band(e.th,0), q=clamp01(t/1.5), a=Math.PI*(1+.5*q+.5*q**3), lift=11*e.u;
  return {x:b.x+(b.rx+lift)*Math.cos(a),y:b.y+(b.ry+lift)*Math.sin(a)};
}
// Points along the school-print strokes of each letter of a word, in a box 138 tall with 88 for each letter.
function letterPoints(word) {
  const out=[];
  try {
    [...word].forEach((c,i)=>{
      for(const d of forms[c] || []) {
        const path=document.createElementNS('http://www.w3.org/2000/svg','path');
        path.setAttribute('d',d);
        const length=path.getTotalLength();
        for(let at=0;at<=length;at+=8){const p=path.getPointAtLength(at);out.push({x:p.x+i*88,y:p.y,letter:i});}
      }
    });
  } catch { /* Without the letter shapes the fireflies simply drift. */ }
  return out;
}
function blob(ctx,x,y,r,wobble,colour) {
  ctx.beginPath();
  for(let i=0;i<=48;i++) {
    const a=i/48*tau, q=r*(1+.17*Math.sin(3*a+wobble[0])+.09*Math.sin(5*a+wobble[1])+.06*Math.sin(8*a+wobble[2]));
    ctx.lineTo(x+Math.cos(a)*q,y+Math.sin(a)*q);
  }
  ctx.closePath();ctx.fillStyle=colour;ctx.fill();
}
function note(ctx,x,y,size,tilt,colour) {
  ctx.save();ctx.translate(x,y);ctx.rotate(tilt);
  ctx.beginPath();ctx.moveTo(size*.42,0);ctx.lineTo(size*.42,-size*2.1);ctx.quadraticCurveTo(size*1.3,-size*1.9,size*1.25,-size*1.05);
  ctx.strokeStyle=ink;ctx.lineWidth=size*.34;ctx.stroke();
  oval(ctx,0,0,size*.6,size*.44,-.35,colour,size*.16);ctx.restore();
}

const SCENES={
  comet:{len:.74,z:8,
    cues:[[.3,e=>{const p=peg(e,1);e.burst(p.x,p.y,few(e,12),190);}],[.72,e=>{e.burst(e.cx,e.cy,few(e,46),400);e.on('onHit');}]],
    draw(e,s,t) {
      if(t>.72) return;
      const ctx=e.ctx, u=e.u, p1=peg(e,1), d=t-.3;
      if(d<=.35){ctx.globalAlpha=d<0?.85:Math.max(0,1-d/.35);drawStar(ctx,p1.x,p1.y,(d<=0?14:18+26*d)*u,.3,five,'#ffdb63');ctx.globalAlpha=1;}
      for(let j=0;j<colours.length;j++) {
        ctx.beginPath();
        for(let k=0;k<=18;k++){const p=ballAt(e,Math.max(0,t-.16+.16*k/18)), y=p.y+(j-3)*3.3*u;if(k===0)ctx.moveTo(p.x,y);else ctx.lineTo(p.x,y);}
        ctx.strokeStyle=colours[j];ctx.lineWidth=4.3*u;ctx.stroke();
      }
      const p=ballAt(e,t);drawStar(ctx,p.x,p.y,22*u,t*4,five,'#ffd752');
    }},

  // Sky
  stars:{len:2.5,z:5,
    cues:[[0,.18,.34,42,290],[.35,.84,.23,45,320],[.8,.30,.18,48,310],[1.1,.73,.24,45,310],[1.6,.5,.16,80,450]]
      .map(([t,x,y,n,power])=>[t,e=>e.burst(x*e.w,y*e.h,few(e,n),power)])},
  fountains:{len:2.5,z:5,
    cues:[[0,.04,60,525],[.2,.96,60,525],[1.0,.08,55,560],[1.15,.92,55,560]].map(([t,x,n,power])=>[t,e=>e.burst(x*e.w,e.h*.88,few(e,n),power,{sky:true})]),
    step(e,s,t,dt) {
      if(t<.25 || t>1.9) return;
      s.next=(s.next || 0)-dt;
      if(s.next>0) return;
      s.next=.055;
      const reach=Math.sqrt(e.h/800);
      for(const side of [-1,1]) e.spark({x:side<0?e.w*.03:e.w*.97,y:e.h+6,vx:-side*(110+e.rand()*210)*e.u,vy:-(640+e.rand()*250)*e.u*reach,
        size:(4+e.rand()*6)*e.u,kind:e.rand()<.3?'star4':'star5',life:1.5+e.rand()*.6,colour:e.rand()<.4?gold:colours[Math.floor(e.rand()*7)],g:3.2,spin:e.rand()*6-3});
    }},
  blooms:{len:2.7,z:5,
    cues:[[0,.22,.3],[.5,.78,.27],[1.0,.5,.15]].map(([t,x,y])=>[t,e=>e.burst(x*e.w,y*e.h,few(e,28),240,{kind:'flower',g:.3,drag:1.3})])},
  // Balls of paint are thrown up from below and stay where they land.
  paint:{len:2.4,stays:true,z:2,
    make(e) {
      return {balls:[[.1,.24],[.9,.2],[.32,.11],[.68,.1],[.06,.56],[.94,.6]].map(([x,y],i)=>({x:x*e.w,y:y*e.h,from:(i%2?.72:.28)*e.w,go:i*.28,
        r:(44+e.rand()*30)*e.u,colour:colours[(i*3+1)%7],wobble:[e.rand()*tau,e.rand()*tau,e.rand()*tau],
        drips:Array.from({length:3},()=>({at:(e.rand()-.5)*1.1,length:(22+e.rand()*46)*e.u,wide:(3+e.rand()*3)*e.u})),
        spots:Array.from({length:5},()=>({a:e.rand()*tau,far:1.25+e.rand()*.5,r:(3+e.rand()*5)*e.u}))}))};
    },
    draw(e,s,t) {
      const ctx=e.ctx;
      for(const b of s.balls) {
        const fly=(t-b.go)/.42;
        if(fly<0) continue;
        if(fly<1){oval(ctx,b.from+(b.x-b.from)*fly,e.h+(b.y-e.h)*ease(fly),9*e.u,9*e.u,0,b.colour,1.6);continue;}
        const age=t-b.go-.42, r=b.r*pop(age/.28);
        ctx.globalAlpha=.86;
        for(const d of b.drips) {
          ctx.beginPath();ctx.moveTo(b.x+d.at*r,b.y+r*.5);ctx.lineTo(b.x+d.at*r,b.y+r*.8+d.length*ease(age/2.2));
          ctx.strokeStyle=b.colour;ctx.lineWidth=d.wide;ctx.stroke();
        }
        blob(ctx,b.x,b.y,r,b.wobble,b.colour);
        for(const d of b.spots){ctx.beginPath();ctx.arc(b.x+Math.cos(d.a)*r*d.far,b.y+Math.sin(d.a)*r*d.far,d.r*clamp01(age/.2),0,tau);ctx.fill();}
        ctx.globalAlpha=.3;blob(ctx,b.x-r*.16,b.y-r*.2,r*.5,b.wobble,'#fff');
        ctx.globalAlpha=1;
      }
    }},

  // Rainbow
  rainbow:{len:1.5,stays:true,z:3,step(e,s,t,dt){glint(e,s,t,dt,false);},draw(e,s,t){if(e.virtual)arcs(e,t,false);}},
  rainbow2:{len:1.4,stays:true,z:3,step(e,s,t,dt){glint(e,s,t,dt,true);},draw(e,s,t){if(e.virtual)arcs(e,t,true);}},
  // A star rides over the rainbow and slides down the far side.
  slide:{len:2.3,z:8,
    cues:[[1.5,e=>{const b=band(e.th,0);e.burst(b.x+b.rx,b.y,few(e,22),230);}]],
    step(e,s,t,dt) {
      if(t>1.5) return;
      s.next=(s.next || 0)-dt;
      if(s.next>0) return;
      s.next=.032;
      const p=rider(e,t);
      e.spark({x:p.x,y:p.y,vx:(e.rand()-.5)*70*e.u,vy:(e.rand()-.3)*70*e.u,size:(3+e.rand()*4)*e.u,kind:e.rand()<.5?'star4':'star5',
        life:.5+e.rand()*.45,colour:colours[Math.floor(e.rand()*7)],g:.5});
    },
    draw(e,s,t) {
      let p=rider(e,t);
      if(t>1.5){const b=band(e.th,0), fall=t-1.5;p={x:b.x+b.rx+250*e.u*fall,y:b.y-470*e.u*fall+900*e.u*fall*fall};}
      drawStar(e.ctx,p.x,p.y,21*e.u,t*8,five,'#ffd752');
    }},
  // The rainbow unhooks, loops around her picture and ties itself in a bow above it.
  ribbon:{len:2.9,z:7,
    make(e) {
      const th=e.th, b=band(th,3), way=[[b.x+b.rx,b.y],[th.x+th.w*1.03,th.y+th.h*1.2],[th.x+th.w*.55,th.y+th.h*1.38],[th.x-th.w*.02,th.y+th.h*1.08],
        [th.x-th.w*.06,th.y+th.h*.32],[th.x+th.w*.18,th.y-th.h*.2],[th.x+th.w*.5,th.y-th.h*.16]].map(([x,y])=>[Math.max(14,Math.min(e.w-14,x)),Math.max(14,Math.min(e.h-14,y))]);
      const pts=[];
      for(let i=0;i<way.length-1;i++) {
        const p0=way[Math.max(0,i-1)], p1=way[i], p2=way[i+1], p3=way[Math.min(way.length-1,i+2)];
        for(let k=0;k<16;k++) {
          const q=k/16, q2=q*q, q3=q2*q;
          pts.push([0,1].map(d=>.5*(2*p1[d]+(p2[d]-p0[d])*q+(2*p0[d]-5*p1[d]+4*p2[d]-p3[d])*q2+(3*p1[d]-p0[d]-3*p2[d]+p3[d])*q3)));
        }
      }
      const knot=way.at(-1), size=Math.min(th.w*.11,90*e.u), bow=pts.length;
      for(let k=0;k<=56;k++){const a=Math.PI/2+k/56*tau, under=1+Math.sin(a)**2;pts.push([knot[0]+size*Math.cos(a)/under*1.35,knot[1]+size*Math.sin(a)*Math.cos(a)/under*1.5]);}
      return {pts,bow,knot,size};
    },
    draw(e,s,t) {
      const ctx=e.ctx, n=s.pts.length-1, head=Math.round(n*clamp01(t/1.9)**.9), tail=Math.max(0,Math.min(head-Math.round(n*.42),s.bow-2)), wide=3.1*e.u;
      const fade=1-clamp01((t-2.5)/.4);
      if(head<1) return;
      ctx.globalAlpha=fade;ctx.lineCap='butt';
      const edge=(offset,colour,width)=>{
        ctx.beginPath();
        for(let i=tail;i<=head;i++) {
          const a=s.pts[Math.max(0,i-1)], b=s.pts[Math.min(n,i+1)], length=Math.hypot(b[0]-a[0],b[1]-a[1]) || 1;
          const x=s.pts[i][0]-(b[1]-a[1])/length*offset, y=s.pts[i][1]+(b[0]-a[0])/length*offset;
          if(i===tail)ctx.moveTo(x,y);else ctx.lineTo(x,y);
        }
        ctx.strokeStyle=colour;ctx.lineWidth=width;ctx.stroke();
      };
      edge(0,ink,wide*7+3.2);
      for(let j=0;j<7;j++) edge((j-3)*wide,colours[j],wide+.7);
      const hang=ease((t-1.9)/.35);
      if(hang>0) for(const side of [-1,1]) {
        ctx.beginPath();ctx.moveTo(s.knot[0],s.knot[1]);ctx.quadraticCurveTo(s.knot[0]+side*s.size*.2,s.knot[1]+s.size*.5*hang,s.knot[0]+side*s.size*.55*hang,s.knot[1]+s.size*1.15*hang);
        ctx.strokeStyle=ink;ctx.lineWidth=wide*3+3;ctx.stroke();ctx.strokeStyle=colours[side<0?0:4];ctx.lineWidth=wide*3;ctx.stroke();
      }
      ctx.lineCap='round';ctx.globalAlpha=1;
    }},

  // Ground
  flowers:poppyScene,
  mushrooms:{len:2,stays:true,z:1,
    make(e) {
      const n=Math.max(3,Math.min(6,Math.round(e.w/230)));
      return {caps:Array.from({length:n},(_,i)=>({x:(i+.3+e.rand()*.4)/n*e.w,r:Math.min((30+e.rand()*24)*e.u,e.h*.06),born:.1+e.rand()*.9,tilt:(e.rand()-.5)*.25,colour:i%2?'#ff8f6b':colours[0]})),
        ferns:Array.from({length:n-1},(_,i)=>({x:(i+1+(e.rand()-.5)*.3)/n*e.w,tall:Math.min((110+e.rand()*80)*e.u,e.h*.2),born:.3+e.rand()*.8,lean:(e.rand()-.5)*.5}))};
    },
    draw(e,s,t) {
      const ctx=e.ctx, wet=e.soak?pop((e.time-e.soak)/.5)*.3:0;
      for(const f of s.ferns) {
        const g=ease((t-f.born)/.9);
        if(g<=0) continue;
        // The frond unrolls from a curl as it grows.
        let x=f.x, y=e.h+2, angle=-Math.PI/2+f.lean*.3;
        const steps=14, piece=f.tall*g*(1+wet)/steps, curl=(1-g)*.5;
        ctx.strokeStyle=ink;ctx.lineWidth=3*e.u;
        for(let i=0;i<steps;i++) {
          const nx=x+Math.cos(angle)*piece, ny=y+Math.sin(angle)*piece, size=(23-i*1.25)*e.u*g;
          ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(nx,ny);ctx.stroke();
          if(i>1 && size>3) for(const side of [-1,1]) leafShape(ctx,nx,ny,size,angle+side*1.15,green);
          x=nx;y=ny;angle+=f.lean*.045+curl*(i/steps)*1.6;
        }
      }
      for(const c of s.caps) {
        const g=pop((t-c.born)/.4);
        if(g<=0) continue;
        const r=c.r*(1+wet*.5);
        ctx.save();ctx.translate(c.x,e.h+2);ctx.rotate(c.tilt);ctx.scale(1,g);
        ctx.beginPath();ctx.moveTo(-r*.3,0);ctx.quadraticCurveTo(-r*.22,-r*.9,-r*.26,-r*1.3);ctx.lineTo(r*.26,-r*1.3);ctx.quadraticCurveTo(r*.22,-r*.9,r*.3,0);ctx.closePath();
        paint(ctx,cream,2*e.u);
        ctx.beginPath();ctx.moveTo(-r,-r*1.2);ctx.bezierCurveTo(-r*.95,-r*2.5,r*.95,-r*2.5,r,-r*1.2);ctx.quadraticCurveTo(0,-r*.98,-r,-r*1.2);ctx.closePath();
        paint(ctx,c.colour,2*e.u);
        ctx.fillStyle=cream;
        for(const [dx,dy,q] of [[-.45,-1.6,.17],[.12,-1.9,.2],[.52,-1.5,.13]]){ctx.beginPath();ctx.arc(dx*r,dy*r,q*r,0,tau);ctx.fill();}
        ctx.restore();
      }
    }},
  vines:{len:3.3,stays:true,z:1,
    make(e) {
      const u=e.u, n=96;
      return {n,sides:[-1,1].map(side=>Array.from({length:n+1},(_,i)=>{
        const q=i/n, edge=18*u+10*u*Math.sin(q*13);
        if(q<.7){const v=q/.7;return [side<0?edge:e.w-edge,e.h-(e.h-24*u)*v];}
        const v=(q-.7)/.3, from=side<0?18*u:e.w-18*u;
        return [from+(e.w/2-from)*v,22*u+8*u*Math.sin(v*9)+(1-v)*4*u];
      }))};
    },
    draw(e,s,t) {
      const ctx=e.ctx, u=e.u, reach=ease(t/2.8)*s.n;
      for(const pts of s.sides) {
        const last=Math.floor(reach);
        if(last<1) continue;
        ctx.beginPath();pts.slice(0,last+1).forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
        ctx.strokeStyle=ink;ctx.lineWidth=6.4*u;ctx.stroke();ctx.strokeStyle=green;ctx.lineWidth=3.6*u;ctx.stroke();
        for(let i=4;i<=last;i+=4) {
          const a=pts[i-1], b=pts[Math.min(s.n,i+1)], along=Math.atan2(b[1]-a[1],b[0]-a[0]), grown=pop((reach-i)/6);
          if(i%16===8) flower(ctx,pts[i][0],pts[i][1],10*u*grown,i,colours[(i/8)%7 | 0],5);
          else leafShape(ctx,pts[i][0],pts[i][1],17*u*grown,along+((i/4)%2?1:-1)*1.05);
        }
      }
      const meet=pop((t-2.8)/.4);
      if(meet>0) flower(ctx,e.w/2,24*u,21*u*meet,t*.6,colours[6],6);
    }},
  // An oak grows at the side in fast forward, then shakes down acorns that bounce.
  oak:{len:3.7,stays:true,z:1,
    make(e) {
      const u=e.u, segs=[], leaves=[], tall=Math.min(e.h*.6,480*u);
      (function grow(x,y,angle,length,width,depth,birth) {
        const x2=x+Math.cos(angle)*length, y2=y+Math.sin(angle)*length;
        segs.push({x,y,x2,y2,width,birth});
        if(depth>=4){leaves.push({x:x2,y:y2,r:(26+e.rand()*16)*u,birth:birth+.4,dark:e.rand()<.45,turn:e.rand()*tau});return;}
        const kids=depth?2:3;
        for(let k=0;k<kids;k++) grow(x2,y2,angle+(k-(kids-1)/2)*(.6+e.rand()*.22)+(e.rand()-.5)*.2,length*(.64+e.rand()*.1),width*.64,depth+1,birth+.38);
      })(e.w*.1,e.h+4,-Math.PI/2+.07,tall*.36,22*u,0,0);
      const acorns=Array.from({length:5},(_,i)=>{const from=leaves[Math.floor(e.rand()*leaves.length)];
        return {x:from.x,y:from.y,vx:(e.rand()-.3)*90*u,vy:0,drop:2.5+i*.17,bounces:0,spin:e.rand()*tau};});
      return {segs,leaves,acorns};
    },
    step(e,s,t,dt) {
      const floor=e.h-9*e.u;
      for(const a of s.acorns) {
        if(t<a.drop || a.bounces>2) continue;
        a.vy+=1500*e.u*dt;a.x+=a.vx*dt;a.y+=a.vy*dt;a.spin+=dt*7;
        if(a.y>floor){a.y=floor;a.vy*=-.46;a.vx*=.7;a.bounces++;}
      }
    },
    draw(e,s,t) {
      const ctx=e.ctx, u=e.u, shake=bump((t-2.3)/.5)*Math.sin(t*46)*3*u;
      for(const pass of [0,1]) for(const g of s.segs) {
        const grown=ease((t-g.birth)/.5);
        if(grown<=0) continue;
        ctx.beginPath();ctx.moveTo(g.x,g.y);ctx.lineTo(g.x+(g.x2-g.x)*grown,g.y+(g.y2-g.y)*grown);
        ctx.strokeStyle=pass?'#8a6a41':ink;ctx.lineWidth=g.width+(pass?0:4.4*u);ctx.stroke();
      }
      for(const l of s.leaves) {
        const grown=pop((t-l.birth)/.45);
        if(grown<=0) continue;
        ctx.beginPath();
        for(let i=0;i<=36;i++){const a=i/36*tau, q=l.r*grown*(1+.13*Math.sin(a*7+l.turn));ctx.lineTo(l.x+shake+Math.cos(a)*q,l.y+Math.sin(a)*q);}
        ctx.closePath();paint(ctx,l.dark?'#5fa873':green,2*u);
      }
      for(const a of s.acorns) {
        if(t<a.drop) continue;
        ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.bounces>2?0:a.spin);
        oval(ctx,0,2*u,6*u,8*u,0,'#d9a760',1.6*u);
        ctx.beginPath();ctx.ellipse(0,-3*u,7.4*u,5*u,0,Math.PI,tau);ctx.closePath();paint(ctx,'#8a6a41',1.6*u);
        ctx.restore();
      }
    }},

  // Her own finds
  // The things in her album march along the bottom. The bug and the sun fly above them.
  parade:{len:2.8,z:6,
    draw(e,s,t) {
      const ctx=e.ctx, u=e.u, list=(e.finds.length?e.finds:['cat','dog','hen']).slice(-9), size=122*u, gap=size*1.02;
      const span=e.w+gap*list.length+size;
      list.forEach((w,j)=>{
        const c=e.cut(w), x=-size*.6+span*t/2.8-j*gap;
        if(!c.ready || x<-size || x>e.w+size) return;
        const flies=w==='bug' || w==='sun', hop=Math.abs(Math.sin(t*7.5+j*.9));
        ctx.save();ctx.translate(x,flies?e.h-size*1.75-Math.sin(t*4+j)*22*u:e.h-size*.5-4*u-hop*16*u);ctx.rotate(flies?Math.sin(t*4+j)*.18:(hop-.5)*.14);
        ctx.drawImage(c.canvas,-size/2,-size/2,size,size);
        if(w!=='hat') e.hat(size*.04,-size*.3,-.08,size*.5);
        ctx.restore();
      });
    }},
  // Fireflies rise and settle into the letters of her word, one letter after another, then drift away.
  fireflies:{len:2.6,z:7,
    make(e) {
      const word=e.word || e.finds[0] || 'cat', pts=letterPoints(word), wide=word.length*88+8;
      const k=Math.min(e.h*.3/138,e.w*.84/wide), left=e.w/2-wide*k/2, top=Math.max(8,Math.min(e.th.y-138*k-6,e.h*.2));
      return {flies:pts.map(p=>({tx:left+p.x*k,ty:top+p.y*k,sx:left+p.x*k+(e.rand()-.5)*220*e.u,go:p.letter*.3+e.rand()*.25,phase:e.rand()*tau}))};
    },
    draw(e,s,t) {
      const ctx=e.ctx, u=e.u, leave=clamp01((t-2)/.6);
      for(const f of s.flies) {
        const fly=ease((t-f.go)/.8);
        if(fly<=0) continue;
        const x=f.sx+(f.tx-f.sx)*fly+Math.sin(t*5+f.phase)*2.5*u*(1+leave*6), y=e.h+20+(f.ty-e.h-20)*fly+Math.cos(t*4+f.phase)*2.5*u-leave*leave*90*u;
        const glow=.75+.25*Math.sin(t*9+f.phase);
        ctx.globalAlpha=(1-leave)*.3;ctx.beginPath();ctx.arc(x,y,10*u*glow,0,tau);ctx.fillStyle=gold;ctx.fill();
        ctx.globalAlpha=1-leave;ctx.beginPath();ctx.arc(x,y,3.9*u,0,tau);paint(ctx,'#fff3a6',1.2*u);
      }
      ctx.globalAlpha=1;
    }},
  // One last firework takes the shape of the thing she found.
  picture:{len:2,z:7,
    cues:[[0,e=>e.ring(e.w/2,Math.max(e.h*.3,150*e.u),90*e.u)]],
    draw(e,s,t) {
      const c=e.cut(e.word || e.finds[0] || 'cat');
      if(!c.ready) return;
      const ctx=e.ctx, u=e.u, size=Math.min(e.w,e.h)*.56, mx=e.w/2, my=Math.max(e.h*.34,170*u), fall=Math.max(0,t-1.4);
      c.points.forEach(([px,py],i)=>{
        const out=ease((t-(i*.618%1)*.14)/.5);
        if(out<=0) return;
        ctx.globalAlpha=1-clamp01(fall/.6);
        drawStar(ctx,mx+px*size*out,my+py*size*out+340*u*fall*fall,(6.5+2*Math.sin(t*9+i))*u,i,four,i%3?gold:colours[i%7]);
      });
      ctx.globalAlpha=1;
    }},
  // Notes float up, to show music in the choices. The music itself is the fanfare.
  notes:{len:2.3,z:6,
    draw(e,s,t) {
      for(let i=0;i<6;i++) {
        const a=clamp01((t-(i*5%6)*.13)/1.5);
        if(a<=0 || a>=1) continue;
        e.ctx.globalAlpha=Math.min(1,(1-a)*3);
        note(e.ctx,e.cx+(i-2.5)*84*e.u+Math.sin(a*6+i)*16*e.u,e.cy+e.h*.3-a*e.h*.56,(24+i%3*6)*e.u,Math.sin(a*5+i)*.3,colours[(i*2)%7]);
      }
      e.ctx.globalAlpha=1;
    }}
};
export {SCENES};
